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
import { buildIconPrompt, ICON_STYLES } from "@/prompts/icon";
import {
  createJobRow,
  loadCreatorForPackage,
  markJobFailed,
  type ModuleEventData,
  type ModuleResult,
} from "./_shared";

const IMAGE_BUCKET = "image-variants";
const ICON_PATH_PREFIX = "icon";

type IconEventData = ModuleEventData;
type IconVariant = { url: string; index: number; durationMs: number };

/**
 * Generate the community icon (PRD I2): three text-forward logo concepts
 * at 512x512. Mirrors generate-cover.ts structurally (durable per-variant
 * step, parallel fan-out, inline retry, finalize-step persistence) but
 * uses the shared image-variants bucket and three distinct stylistic
 * prompts so variants are visually different rather than three samples
 * of the same prompt.
 */
export const generateIcon = inngest.createFunction(
  {
    id: "generate-icon",
    name: "Generate community icon",
    retries: 3,
    triggers: [{ event: "generate.icon.requested" }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: IconEventData } }).event
        ?.data;
      if (!data?.packageId) return;
      const [row] = await db
        .select({ id: generationJobs.id })
        .from(generationJobs)
        .where(
          and(
            eq(generationJobs.packageId, data.packageId),
            eq(generationJobs.module, "icon"),
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
    const data = event.data as IconEventData;
    const tag = "[gen/icon]";

    const jobId = await step.run("create-job", () =>
      createJobRow({
        packageId: data.packageId,
        module: "icon",
        userId: data.userId,
        inngestRunId: runId,
      }),
    );

    const prep = await step.run("prepare", async () => {
      const creator = await loadCreatorForPackage({
        packageId: data.packageId,
        userId: data.userId,
      });
      const creatorContext = toCreatorContext(creator);
      const prompts = ICON_STYLES.map((style) =>
        buildIconPrompt({
          creator: creatorContext,
          style,
          regenerateNote: data.regenerateNote,
        }),
      );
      console.log(
        `${tag} ${prompts.length} variant prompts built (lengths=${prompts.map((p) => p.length).join(",")})`,
      );
      return { prompts };
    });

    const VARIANT_INLINE_RETRIES = 2;

    const variantSteps = ICON_STYLES.map((_, i) => {
      const idx = i + 1;
      return step.run(`variant-${idx}`, async (): Promise<IconVariant> => {
        const start = Date.now();
        let lastErr: unknown;
        for (let attempt = 1; attempt <= VARIANT_INLINE_RETRIES; attempt++) {
          try {
            console.log(
              `${tag} variant-${idx} calling image provider (attempt ${attempt}/${VARIANT_INLINE_RETRIES})`,
            );
            const { images } = await getImageProvider().generate({
              prompt: prep.prompts[i],
              numVariants: 1,
              width: 512,
              height: 512,
              packageId: data.packageId,
              // Aggregate usage logged once in finalize.
            });

            const supabase = createServiceClient();
            const path = `${data.packageId}/${ICON_PATH_PREFIX}/variant-${idx}.png`;
            const { error: upErr } = await supabase.storage
              .from(IMAGE_BUCKET)
              .upload(path, images[0], {
                contentType: "image/png",
                upsert: true,
              });
            if (upErr) {
              throw new Error(
                `icon upload failed for variant ${idx}: ${upErr.message}`,
              );
            }
            const { data: pub } = supabase.storage
              .from(IMAGE_BUCKET)
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
          }
        }
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
          module: "icon",
          version: 1,
          content: { variants: persistedVariants },
          approved: false,
          editHistory: [],
          createdBy: data.userId,
        })
        .returning({ id: generatedAssets.id });
      console.log(`${tag} asset inserted id=${asset.id}`);

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
