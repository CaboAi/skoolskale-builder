import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { generationJobs, generatedAssets } from "@/lib/db/schema";
import { createServiceClient } from "@/lib/supabase/server";
import { toCreatorContext } from "@/types/generators";
import { generateCoverImages } from "@/lib/gemini-image/generate";
import { buildImagePrompt, type CoverStyle } from "@/prompts/cover";
import {
  createJobRow,
  loadCreatorForPackage,
  markJobFailed,
  type ModuleEventData,
  type ModuleResult,
} from "./_shared";

const COVER_BUCKET = "cover-variants";
const NUM_VARIANTS = 3;

/**
 * Event payload shape. Extends the shared ModuleEventData with an optional
 * VA-supplied style override that wins over the niche default in
 * buildImagePrompt.
 */
type CoverEventData = ModuleEventData & {
  styleOverride?: CoverStyle;
};

type CoverVariant = { url: string; index: number };

/**
 * Generate the cover image for a launch package.
 *
 * Flow (mirrors the copy generators but calls Gemini instead of Claude and
 * writes N image variants instead of one parsed text payload):
 *   1. Insert generation_jobs row (status: running)
 *   2. Load creator + launch_package
 *   3. Build image prompt from creator context
 *   4. Call generateCoverImages → N image buffers (logs gemini_image_usage)
 *   5. Upload each buffer to cover-variants bucket, collect public URLs
 *   6. Write one generated_assets row with { variants: [{url, index}] }
 *   7. Mark job done
 *
 * On 3-retry exhaustion the onFailure handler marks the job 'failed' so the
 * VA sees a surfaceable error. `_factory.ts` can't be reused here because
 * the image path doesn't use the Claude prompt/parse contract.
 */
export const generateCover = inngest.createFunction(
  {
    id: "generate-cover",
    name: "Generate cover image",
    retries: 3,
    triggers: [{ event: "generate.cover.requested" }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: CoverEventData } }).event
        ?.data;
      if (!data?.packageId) return;
      const [row] = await db
        .select({ id: generationJobs.id })
        .from(generationJobs)
        .where(
          and(
            eq(generationJobs.packageId, data.packageId),
            eq(generationJobs.module, "cover"),
            eq(generationJobs.status, "running"),
          ),
        )
        .orderBy(desc(generationJobs.startedAt))
        .limit(1);
      if (row) {
        await markJobFailed(
          row.id,
          (error as Error)?.message ?? "unknown failure",
        );
      }
    },
  },
  async ({ event, step, runId }): Promise<ModuleResult> => {
    const data = event.data as CoverEventData;
    const tag = "[gen/cover]";

    const jobId = await step.run("create-job", () =>
      createJobRow({
        packageId: data.packageId,
        module: "cover",
        userId: data.userId,
        inngestRunId: runId,
      }),
    );

    const assetId = await step.run("run-cover", async () => {
      console.log(`${tag} loadCreatorForPackage`);
      const creator = await loadCreatorForPackage({
        packageId: data.packageId,
        userId: data.userId,
      });
      const creatorContext = toCreatorContext(creator);

      const prompt = buildImagePrompt({
        creator: creatorContext,
        transformationLine: creatorContext.transformation,
        styleOverride: data.styleOverride,
      });
      console.log(`${tag} prompt built (length=${prompt.length})`);

      console.log(
        `${tag} calling generateCoverImages (numVariants=${NUM_VARIANTS})`,
      );
      const { images, costUsd } = await generateCoverImages({
        prompt,
        referenceImageUrl: creatorContext.creator_photo_url,
        numVariants: NUM_VARIANTS,
        packageId: data.packageId,
        jobId,
      });
      console.log(
        `${tag} Gemini done images=${images.length} costUsd=${costUsd}`,
      );

      const supabase = createServiceClient();
      const variants: CoverVariant[] = [];
      for (let i = 0; i < images.length; i++) {
        const path = `${data.packageId}/variant-${i + 1}.png`;
        const { error: upErr } = await supabase.storage
          .from(COVER_BUCKET)
          .upload(path, images[i], {
            contentType: "image/png",
            upsert: true,
          });
        if (upErr) {
          throw new Error(
            `cover upload failed for variant ${i + 1}: ${upErr.message}`,
          );
        }
        const { data: pub } = supabase.storage
          .from(COVER_BUCKET)
          .getPublicUrl(path);
        variants.push({ url: pub.publicUrl, index: i + 1 });
      }
      console.log(`${tag} uploaded ${variants.length} variants`);

      const [asset] = await db
        .insert(generatedAssets)
        .values({
          packageId: data.packageId,
          module: "cover",
          version: 1,
          content: { variants },
          approved: false,
          editHistory: [],
          createdBy: data.userId,
        })
        .returning({ id: generatedAssets.id });
      console.log(`${tag} asset inserted id=${asset.id}`);

      await db
        .update(generationJobs)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(generationJobs.id, jobId));

      return asset.id;
    });

    return { jobId, assetId };
  },
);
