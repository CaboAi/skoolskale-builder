import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { generationJobs, generatedAssets } from "@/lib/db/schema";
import { createServiceClient } from "@/lib/supabase/server";
import { toCreatorContext } from "@/types/generators";
import {
  generateCoverImages,
  DEFAULT_MODEL,
} from "@/lib/gemini-image/generate";
import { logGeminiImageUsage } from "@/lib/gemini-image/usage";
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

type CoverVariant = { url: string; index: number; durationMs: number };

/**
 * Generate the cover image for a launch package.
 *
 * Steps (each is durable across retries — Inngest persists results, so a
 * timeout on variant 3 won't re-do variants 1 and 2):
 *   1. create-job — insert generation_jobs row (status: running)
 *   2. prepare — load creator, build prompt, return prompt + reference url
 *   3. variant-1, variant-2, variant-3 — run in parallel; each generates one
 *      Gemini image and uploads it to cover-variants. Each is its own step,
 *      so they retry independently.
 *   4. finalize — write generated_assets, log aggregate Gemini usage, mark
 *      job done.
 *
 * On 3-retry exhaustion the onFailure handler marks the job 'failed' so the
 * VA sees a surfaceable error.
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

    const prep = await step.run("prepare", async () => {
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
      return {
        prompt,
        referenceImageUrl: creatorContext.creator_photo_url ?? null,
      };
    });

    // Max attempts per variant when Gemini hangs or returns a transient
    // error. We retry inline (inside the same step.run) instead of relying
    // on Inngest's function-level retry, because Inngest applies an
    // exponential backoff that can add 1-2 min of dead time. Inline retry
    // reuses the warm Vercel function and starts immediately.
    const VARIANT_INLINE_RETRIES = 2;

    // Each variant gets its own step.run so a successful URL is persisted
    // across function-level retries. Promise.all runs all three concurrently.
    const variantSteps = Array.from({ length: NUM_VARIANTS }, (_, i) => {
      const idx = i + 1;
      return step.run(`variant-${idx}`, async (): Promise<CoverVariant> => {
        const start = Date.now();

        let lastErr: unknown;
        for (let attempt = 1; attempt <= VARIANT_INLINE_RETRIES; attempt++) {
          try {
            console.log(
              `${tag} variant-${idx} calling Gemini (attempt ${attempt}/${VARIANT_INLINE_RETRIES})`,
            );
            const { images } = await generateCoverImages({
              prompt: prep.prompt,
              referenceImageUrl: prep.referenceImageUrl ?? undefined,
              numVariants: 1,
              packageId: data.packageId,
              // Intentionally omit jobId — three parallel variants would
              // race on gemini_image_usage. Aggregate usage is logged once
              // in the finalize step.
            });

            const supabase = createServiceClient();
            const path = `${data.packageId}/variant-${idx}.png`;
            const { error: upErr } = await supabase.storage
              .from(COVER_BUCKET)
              .upload(path, images[0], {
                contentType: "image/png",
                upsert: true,
              });
            if (upErr) {
              throw new Error(
                `cover upload failed for variant ${idx}: ${upErr.message}`,
              );
            }
            const { data: pub } = supabase.storage
              .from(COVER_BUCKET)
              .getPublicUrl(path);

            const durationMs = Date.now() - start;
            console.log(
              `${tag} variant-${idx} done url=${pub.publicUrl} ms=${durationMs} attempts=${attempt}`,
            );
            return { url: pub.publicUrl, index: i, durationMs };
          } catch (err) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(
              `${tag} variant-${idx} attempt ${attempt} failed: ${msg}`,
            );
            // Loop and try again immediately. No backoff — the most common
            // cause is a hung Gemini socket that's already been aborted.
          }
        }

        // All inline attempts failed. Throw so Inngest's function-level
        // retry can take a fresh stab from a clean function instance.
        throw lastErr instanceof Error
          ? lastErr
          : new Error(`variant-${idx} exhausted inline retries`);
      });
    });

    const variants = (await Promise.all(variantSteps)).sort(
      (a, b) => a.index - b.index,
    );

    const assetId = await step.run("finalize", async () => {
      const totalDurationMs = variants.reduce(
        (sum, v) => sum + v.durationMs,
        0,
      );
      const persistedVariants = variants.map(({ url, index }) => ({
        url,
        index,
      }));

      const [asset] = await db
        .insert(generatedAssets)
        .values({
          packageId: data.packageId,
          module: "cover",
          version: 1,
          content: { variants: persistedVariants },
          approved: false,
          editHistory: [],
          createdBy: data.userId,
        })
        .returning({ id: generatedAssets.id });
      console.log(`${tag} asset inserted id=${asset.id}`);

      // Best-effort usage write — logger swallows its own errors.
      await logGeminiImageUsage({
        jobId,
        model: DEFAULT_MODEL,
        numImages: variants.length,
        durationMs: totalDurationMs,
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
