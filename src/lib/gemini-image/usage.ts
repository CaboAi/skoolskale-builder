import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generationJobs } from "@/lib/db/schema";

/**
 * Gemini image pricing (as of 2026-04). Cost is per generated image at 1K
 * resolution. Keyed off the model id so a future model bump doesn't silently
 * zero our cost tracking.
 */
const PRICING = {
  "gemini-3.1-flash-image-preview": { perImage: 0.045 },
} as const;

type ModelId = keyof typeof PRICING;

export type GeminiImageUsage = {
  model: string;
  numImages: number;
  durationMs: number;
  costUsd: number;
};

export function estimateImageCostUsd(model: string, numImages: number): number {
  const rates =
    (PRICING as Record<string, { perImage: number }>)[model] ??
    PRICING["gemini-3.1-flash-image-preview"];
  return Number((numImages * rates.perImage).toFixed(6));
}

/**
 * Persist usage to `generation_jobs.gemini_image_usage`. Swallows errors — a
 * broken logger should never tank a generation.
 */
export async function logGeminiImageUsage(params: {
  jobId: string;
  model: ModelId | string;
  numImages: number;
  durationMs: number;
}): Promise<void> {
  try {
    const costUsd = estimateImageCostUsd(params.model, params.numImages);
    const payload: GeminiImageUsage = {
      model: params.model,
      numImages: params.numImages,
      durationMs: params.durationMs,
      costUsd,
    };
    await db
      .update(generationJobs)
      .set({ geminiImageUsage: payload })
      .where(eq(generationJobs.id, params.jobId));
  } catch (err) {
    // Never throw — the caller's generation succeeded; accounting is best-effort.
    console.error("[gemini-image/usage] logging failed:", err);
  }
}
