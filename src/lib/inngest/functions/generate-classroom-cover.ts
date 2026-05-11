import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { generationJobs, generatedAssets } from "@/lib/db/schema";
import { createServiceClient } from "@/lib/supabase/server";
import { toCreatorContext } from "@/types/generators";
import { DEFAULT_MODEL } from "@/lib/gemini-image/generate";
import { logGeminiImageUsage } from "@/lib/gemini-image/usage";
import { getImageProvider } from "@/lib/image-providers";
import { buildClassroomCoverPrompt } from "@/prompts/classroom_cover";
import {
  createJobRow,
  loadCreatorForPackage,
  markJobFailed,
  type ModuleEventData,
  type ModuleResult,
} from "./_shared";

const IMAGE_BUCKET = "image-variants";
const PATH_PREFIX = "classroom_cover";

type ClassroomCoverEventData = ModuleEventData;

/**
 * Generate the single Classroom-section cover image (1456x816) for the
 * Skool community. Mirrors the cover/icon Inngest pattern minus the
 * variant fan-out — there's only one image to produce.
 */
export const generateClassroomCover = inngest.createFunction(
  {
    id: "generate-classroom-cover",
    name: "Generate classroom cover image",
    retries: 3,
    triggers: [{ event: "generate.classroom_cover.requested" }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: ClassroomCoverEventData } })
        .event?.data;
      if (!data?.packageId) return;
      const [row] = await db
        .select({ id: generationJobs.id })
        .from(generationJobs)
        .where(
          and(
            eq(generationJobs.packageId, data.packageId),
            eq(generationJobs.module, "classroom_cover"),
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
    const data = event.data as ClassroomCoverEventData;
    const tag = "[gen/classroom_cover]";

    const jobId = await step.run("create-job", () =>
      createJobRow({
        packageId: data.packageId,
        module: "classroom_cover",
        userId: data.userId,
        inngestRunId: runId,
      }),
    );

    const prep = await step.run("prepare", async () => {
      if (data.editedPrompt) {
        console.log(
          `${tag} editedPrompt path (length=${data.editedPrompt.length}); skipping builder`,
        );
        return { prompt: data.editedPrompt };
      }
      const creator = await loadCreatorForPackage({
        packageId: data.packageId,
        userId: data.userId,
      });
      const prompt = buildClassroomCoverPrompt({
        creator: toCreatorContext(creator),
        regenerateNote: data.regenerateNote,
      });
      console.log(`${tag} prompt built (length=${prompt.length})`);
      return { prompt };
    });

    const VARIANT_INLINE_RETRIES = 2;

    const variant = await step.run("variant-1", async () => {
      const start = Date.now();
      let lastErr: unknown;
      for (let attempt = 1; attempt <= VARIANT_INLINE_RETRIES; attempt++) {
        try {
          console.log(
            `${tag} calling image provider (attempt ${attempt}/${VARIANT_INLINE_RETRIES})`,
          );
          const { images } = await getImageProvider().generate({
            prompt: prep.prompt,
            numVariants: 1,
            width: 1456,
            height: 816,
            packageId: data.packageId,
          });

          const supabase = createServiceClient();
          const path = `${data.packageId}/${PATH_PREFIX}/variant-0.png`;
          const { error: upErr } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(path, images[0], {
              contentType: "image/png",
              upsert: true,
            });
          if (upErr) {
            throw new Error(
              `classroom_cover upload failed: ${upErr.message}`,
            );
          }
          const { data: pub } = supabase.storage
            .from(IMAGE_BUCKET)
            .getPublicUrl(path);

          const durationMs = Date.now() - start;
          console.log(
            `${tag} done url=${pub.publicUrl} ms=${durationMs} attempts=${attempt}`,
          );
          return { url: pub.publicUrl, durationMs };
        } catch (err) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`${tag} attempt ${attempt} failed: ${msg}`);
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error("classroom_cover exhausted inline retries");
    });

    const assetId = await step.run("finalize", async () => {
      const [asset] = await db
        .insert(generatedAssets)
        .values({
          packageId: data.packageId,
          module: "classroom_cover",
          version: 1,
          content: { variants: [{ url: variant.url, index: 0 }] },
          approved: false,
          editHistory: [],
          createdBy: data.userId,
        })
        .returning({ id: generatedAssets.id });
      console.log(`${tag} asset inserted id=${asset.id}`);

      await logGeminiImageUsage({
        jobId,
        model: DEFAULT_MODEL,
        numImages: 1,
        durationMs: variant.durationMs,
      });

      await db
        .update(generationJobs)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(generationJobs.id, jobId));

      return asset.id;
    });

    return { jobId, assetId };
  },
);
