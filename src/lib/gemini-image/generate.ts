import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { estimateImageCostUsd, logGeminiImageUsage } from "./usage";

/**
 * Default image model. Change in one place; cost table in ./usage.ts keys off
 * this. "Nano Banana 2" preview id as of 2026-04.
 */
export const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";

export type ReferenceImageSource =
  | { kind: "url"; url: string }
  | { kind: "storage"; bucket: string; path: string };

export type GenerateCoverImagesParams = {
  prompt: string;
  /**
   * Reference image for Gemini. Prefer `{ kind: 'storage' }` — it uses
   * `supabase.storage.download()` under service-role, which:
   *   - works regardless of bucket public/private state (survives Stage 4),
   *   - avoids any signed-URL TTL race mid-Gemini call,
   *   - skips one network hop.
   * The `{ kind: 'url' }` variant remains for ad-hoc callers (CLIs, tests)
   * that already have a URL and don't want to plumb bucket/path.
   */
  referenceImage?: ReferenceImageSource;
  numVariants: number;
  packageId: string;
  /**
   * The generation_jobs row id this call belongs to. Usage rows write here.
   * Optional for ad-hoc callers (CLIs, tests) — when omitted we skip logging.
   */
  jobId?: string;
  model?: string;
};

export type GenerateCoverImagesResult = {
  images: Buffer[];
  costUsd: number;
};

type ReferenceImage = { data: string; mimeType: string };

/**
 * Hard ceiling on a single Gemini image generation. Nano Banana 2 (preview)
 * is variable: median ~30-60s, p99 reaches 90-120s under load with reference
 * images. A 60s ceiling aborted legit-but-slow calls and caused Inngest to
 * retry the whole function — making good runs look broken. 120s gives the
 * SDK a real shot before we cut the cord, while staying well under Vercel's
 * 300s maxDuration so finalize/upload have headroom. The SDK abortSignal
 * (below) actually cancels the underlying fetch when this fires, so we
 * don't pay for a dangling socket.
 */
const GEMINI_CALL_TIMEOUT_MS = 120_000;
const REFERENCE_FETCH_TIMEOUT_MS = 10_000;

async function fetchReferenceImage(url: string): Promise<ReferenceImage> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REFERENCE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(
      `[gemini-image] reference fetch failed: ${res.status} ${res.statusText}`,
    );
  }
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { data: bytes.toString("base64"), mimeType };
}

/**
 * Load a reference image directly from Supabase Storage as base64 bytes.
 * Uses the service-role client so this works regardless of bucket
 * visibility — Stage 4 of the signed-URLs migration will flip buckets to
 * private; this path stays unchanged.
 */
async function loadReferenceImageFromStorage(
  bucket: string,
  path: string,
): Promise<ReferenceImage> {
  const supabase = createServiceClient();
  const { data: blob, error } = await supabase.storage
    .from(bucket)
    .download(path);
  if (error || !blob) {
    throw new Error(
      `[gemini-image] reference download failed for ${bucket}/${path}: ${
        error?.message ?? "no blob"
      }`,
    );
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { data: bytes.toString("base64"), mimeType: blob.type || "image/jpeg" };
}

async function resolveReferenceImage(
  source: ReferenceImageSource,
): Promise<ReferenceImage> {
  if (source.kind === "storage") {
    return loadReferenceImageFromStorage(source.bucket, source.path);
  }
  return fetchReferenceImage(source.url);
}

/**
 * Race a generateContent call against a timeout. The caller passes an
 * AbortSignal into the SDK (see `generateCoverImages`) so the underlying
 * fetch is actually cancelled when this fires. This Promise.race remains
 * as the source of the human-readable "exceeded Nms" error — the SDK's
 * own abort error has a less specific message and is harder to match in
 * monitoring/log filters.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`[gemini-image] ${label} exceeded ${ms}ms — retrying`),
        ),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function extractImage(response: unknown): Buffer {
  // SDK shape: response.candidates[0].content.parts[].inlineData.{data, mimeType}
  const candidates = (response as { candidates?: unknown[] } | undefined)
    ?.candidates;
  const parts = (
    candidates?.[0] as
      | { content?: { parts?: Array<{ inlineData?: { data?: string } }> } }
      | undefined
  )?.content?.parts;
  const inline = parts?.find((p) => p?.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    throw new Error("[gemini-image] no inlineData in response");
  }
  return Buffer.from(inline.data, "base64");
}

/**
 * Generate N cover image variants via Gemini 3.1 Flash Image ("Nano Banana 2").
 * Nano Banana returns one image per call, so we loop numVariants times.
 *
 * - No retry logic here — Inngest owns retries at the step level.
 * - Usage logging is fire-and-forget; the generation's success is independent
 *   of whether the audit write succeeded.
 */
export async function generateCoverImages(
  params: GenerateCoverImagesParams,
): Promise<GenerateCoverImagesResult> {
  if (params.numVariants < 1) {
    throw new Error("[gemini-image] numVariants must be >= 1");
  }
  const model = params.model ?? DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });

  const reference = params.referenceImage
    ? await resolveReferenceImage(params.referenceImage)
    : undefined;

  const parts: Array<
    { text: string } | { inlineData: { data: string; mimeType: string } }
  > = [{ text: params.prompt }];
  if (reference) {
    parts.push({ inlineData: reference });
  }
  const contents = [{ role: "user", parts }];

  const start = Date.now();
  const images: Buffer[] = [];
  for (let i = 0; i < params.numVariants; i++) {
    // Two layers of timeout: AbortSignal.timeout cancels the actual HTTP
    // request inside the SDK, withTimeout rejects the awaiting promise
    // with our recognizable error message so log filters still match.
    const abortSignal = AbortSignal.timeout(GEMINI_CALL_TIMEOUT_MS);
    const response = await withTimeout(
      ai.models.generateContent({ model, contents, config: { abortSignal } }),
      GEMINI_CALL_TIMEOUT_MS,
      `generateContent variant ${i + 1}/${params.numVariants}`,
    );
    images.push(extractImage(response));
  }
  const durationMs = Date.now() - start;

  const costUsd = estimateImageCostUsd(model, images.length);

  if (params.jobId) {
    // Awaited but logGeminiImageUsage swallows its own errors.
    await logGeminiImageUsage({
      jobId: params.jobId,
      model,
      numImages: images.length,
      durationMs,
    });
  }

  return { images, costUsd };
}
