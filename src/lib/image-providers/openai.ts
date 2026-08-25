import "server-only";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { estimateImageCostUsd, type ImageTokenUsage } from "@/lib/images/usage";
import type {
  ImageGenerateArgs,
  ImageGenerateResult,
  ImageProvider,
  ReferenceImageSource,
} from "@/lib/image-providers/types";

/**
 * OpenAI gpt-image-1 provider.
 *
 * Raw `fetch` rather than the `openai` SDK: this is two HTTP calls, and the
 * only new dependency this phase justified was sharp.
 *
 * Two endpoints, chosen by whether references are present:
 *   - /v1/images/generations — JSON, text-to-image
 *   - /v1/images/edits       — multipart, accepts multiple input images
 *
 * NOTE (empirical, verify when the key lands): the edits endpoint biases
 * toward TRANSFORMING its inputs rather than treating them as loose style
 * reference. That is what we want for a creator headshot and a risk for the
 * style anchor, which could come back as a near-duplicate. The prompt says
 * "match the art direction; composition and subject must be new". If the
 * anchor copies too hard in practice, drop it and rely on the style block.
 */

const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_IMAGE_MODEL = "gpt-image-1";

/**
 * gpt-image-1 at quality:"high" is slow — 60-90s typical, and the tail is
 * long under load. 150s leaves real headroom inside the 300s Hobby per-step
 * ceiling for the sharp resize and the storage upload that follow it.
 */
const IMAGE_CALL_TIMEOUT_MS = 150_000;
const REFERENCE_FETCH_TIMEOUT_MS = 10_000;

type LoadedReference = { bytes: Buffer; mimeType: string; filename: string };

type OpenAiImageResponse = {
  data?: { b64_json?: string }[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { image_tokens?: number; text_tokens?: number };
  };
  error?: { message?: string; type?: string };
};

function requireApiKey(): string {
  const key = env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "[openai-image] OPENAI_API_KEY is not configured — set it in .env.local and Vercel before generating images",
    );
  }
  return key;
}

/**
 * Belt-and-braces around `AbortSignal.timeout`. The signal cancels the
 * socket; this race guarantees a greppable message even if a hang happens
 * somewhere the signal doesn't reach (body streaming, DNS).
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`[openai-image] ${label} exceeded ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

async function loadFromStorage(
  bucket: string,
  path: string,
  index: number,
): Promise<LoadedReference> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(
      `[openai-image] reference download failed (${bucket}/${path}): ${error?.message ?? "no body"}`,
    );
  }
  const mimeType = data.type || "image/png";
  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    mimeType,
    filename: `reference-${index}.${extensionFor(mimeType)}`,
  };
}

async function loadFromUrl(
  url: string,
  index: number,
): Promise<LoadedReference> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REFERENCE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(
      `[openai-image] reference fetch failed: ${res.status} ${res.statusText}`,
    );
  }
  const mimeType = res.headers.get("content-type") ?? "image/png";
  return {
    bytes: Buffer.from(await res.arrayBuffer()),
    mimeType,
    filename: `reference-${index}.${extensionFor(mimeType)}`,
  };
}

async function loadReferences(
  sources: ReferenceImageSource[],
): Promise<LoadedReference[]> {
  return Promise.all(
    sources.map((source, i) =>
      source.kind === "storage"
        ? loadFromStorage(source.bucket, source.path, i)
        : loadFromUrl(source.url, i),
    ),
  );
}

function readTokens(res: OpenAiImageResponse): ImageTokenUsage | undefined {
  if (!res.usage) return undefined;
  const imageInputTokens = res.usage.input_tokens_details?.image_tokens ?? 0;
  const textTokens =
    res.usage.input_tokens_details?.text_tokens ??
    Math.max((res.usage.input_tokens ?? 0) - imageInputTokens, 0);
  return {
    inputTokens: textTokens,
    imageInputTokens,
    outputTokens: res.usage.output_tokens ?? 0,
  };
}

function firstImage(res: OpenAiImageResponse): Buffer {
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("[openai-image] response contained no image data");
  }
  return Buffer.from(b64, "base64");
}

async function postGenerations(
  args: ImageGenerateArgs,
  model: string,
  apiKey: string,
): Promise<OpenAiImageResponse> {
  const res = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: args.prompt,
      size: args.size,
      quality: args.quality,
      n: 1,
      output_format: "png",
      background: args.background === "transparent" ? "transparent" : "opaque",
    }),
    signal: AbortSignal.timeout(IMAGE_CALL_TIMEOUT_MS),
  });
  return handleResponse(res);
}

async function postEdits(
  args: ImageGenerateArgs,
  references: LoadedReference[],
  model: string,
  apiKey: string,
): Promise<OpenAiImageResponse> {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", args.prompt);
  form.append("size", args.size);
  form.append("quality", args.quality);
  form.append("n", "1");
  form.append(
    "background",
    args.background === "transparent" ? "transparent" : "opaque",
  );
  // Only worth the extra cost when a real face is in play; for a style
  // anchor high fidelity is actively counterproductive (it copies).
  if (args.hasPortraitReference) {
    form.append("input_fidelity", "high");
  }
  for (const ref of references) {
    form.append(
      "image[]",
      new Blob([new Uint8Array(ref.bytes)], { type: ref.mimeType }),
      ref.filename,
    );
  }

  const res = await fetch(`${OPENAI_BASE_URL}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(IMAGE_CALL_TIMEOUT_MS),
  });
  return handleResponse(res);
}

async function handleResponse(res: Response): Promise<OpenAiImageResponse> {
  const text = await res.text();
  let parsed: OpenAiImageResponse;
  try {
    parsed = JSON.parse(text) as OpenAiImageResponse;
  } catch {
    throw new Error(
      `[openai-image] non-JSON response (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `[openai-image] ${res.status} ${res.statusText}: ${parsed.error?.message ?? text.slice(0, 300)}`,
    );
  }
  return parsed;
}

/**
 * No retries in here by design — the Inngest step owns them, and a retry
 * budget spent inside a 150s call is a budget that can't back off.
 */
export const openAiImageProvider: ImageProvider = {
  name: "openai-gpt-image-1",

  async generate(args: ImageGenerateArgs): Promise<ImageGenerateResult> {
    const apiKey = requireApiKey();
    const model = args.model ?? DEFAULT_IMAGE_MODEL;
    const started = Date.now();

    const sources = args.referenceImages ?? [];
    const references = sources.length
      ? await withTimeout(
          loadReferences(sources),
          REFERENCE_FETCH_TIMEOUT_MS * 2,
          "reference load",
        )
      : [];

    const response = await withTimeout(
      references.length
        ? postEdits(args, references, model, apiKey)
        : postGenerations(args, model, apiKey),
      IMAGE_CALL_TIMEOUT_MS,
      references.length ? "images.edits" : "images.generations",
    );

    const tokens = readTokens(response);
    return {
      image: firstImage(response),
      costUsd: estimateImageCostUsd({ model, size: args.size, tokens }),
      modelUsed: model,
      durationMs: Date.now() - started,
      tokens,
    };
  },
};
