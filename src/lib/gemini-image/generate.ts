import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { estimateImageCostUsd, logGeminiImageUsage } from "./usage";

/**
 * Default image model. Change in one place; cost table in ./usage.ts keys off
 * this. "Nano Banana 2" preview id as of 2026-04.
 */
export const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";

export type GenerateCoverImagesParams = {
  prompt: string;
  referenceImageUrl?: string;
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
 * Hard ceiling on a single Gemini image generation. Nano Banana 2 typically
 * returns in 15-40s; if we're past 90s the call has almost certainly hung
 * server-side. We'd rather fail fast and let Inngest retry the step than
 * hold the Vercel function open until it 504s — a 504 wastes the whole
 * function invocation; an aborted fetch lets Inngest pick up immediately.
 */
const GEMINI_CALL_TIMEOUT_MS = 90_000;
const REFERENCE_FETCH_TIMEOUT_MS = 15_000;

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
 * Race a generateContent call against a timeout. The Google GenAI SDK
 * doesn't surface AbortSignal cleanly, so we use Promise.race — the SDK
 * call keeps running in the background, but we throw on the caller side
 * so Inngest can retry without waiting on the underlying socket.
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

  const reference = params.referenceImageUrl
    ? await fetchReferenceImage(params.referenceImageUrl)
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
    const response = await withTimeout(
      ai.models.generateContent({ model, contents }),
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
