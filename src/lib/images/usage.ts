import type { ProviderSize } from "@/lib/images/slots";

/**
 * OpenAI image pricing (gpt-image-1).
 *
 * TODO(pricing): verify both tables against
 * https://openai.com/api/pricing the day the API key lands. These are the
 * published figures at time of writing; an image API is the one place where
 * a stale table turns into a real invoice surprise.
 *
 * Two paths on purpose:
 *   - Token-based, when the response carries a `usage` block. Accurate.
 *   - Flat per-image, when it doesn't. gpt-image-1 has historically returned
 *     usage inconsistently across endpoints, and a missing usage block must
 *     not silently record a $0 image.
 *
 * Pure module — no `server-only`, so the cost estimate can also be shown in
 * the UI without a round trip.
 */
type TokenRates = {
  textInputPerM: number;
  imageInputPerM: number;
  outputPerM: number;
};

type FlatRates = Record<ProviderSize, number>;

type ImagePricing = {
  tokens: TokenRates;
  /** Per-image fallback, quality: "high". */
  flatHigh: FlatRates;
};

const PRICING: Record<string, ImagePricing> = {
  "gpt-image-1": {
    tokens: { textInputPerM: 5, imageInputPerM: 10, outputPerM: 40 },
    flatHigh: {
      "1024x1024": 0.167,
      "1536x1024": 0.25,
      "1024x1536": 0.25,
    },
  },
  "gpt-image-1-mini": {
    tokens: { textInputPerM: 2, imageInputPerM: 2.5, outputPerM: 8 },
    flatHigh: {
      "1024x1024": 0.04,
      "1536x1024": 0.06,
      "1024x1536": 0.06,
    },
  },
};

const DEFAULT_MODEL_PRICING = "gpt-image-1";

export type ImageTokenUsage = {
  inputTokens: number;
  imageInputTokens: number;
  outputTokens: number;
};

export type ImageUsage = {
  model: string;
  size: ProviderSize;
  durationMs: number;
  costUsd: number;
  tokens?: ImageTokenUsage;
};

/**
 * Cost for one generated image.
 *
 * An unknown model falls back to gpt-image-1's rates rather than returning
 * zero — the pre-#39 Gemini usage module learned this the hard way: a silent
 * zero looks exactly like a free call in the cost roll-up.
 */
export function estimateImageCostUsd(input: {
  model: string;
  size: ProviderSize;
  tokens?: ImageTokenUsage;
}): number {
  const pricing = PRICING[input.model] ?? PRICING[DEFAULT_MODEL_PRICING];

  if (input.tokens) {
    const { inputTokens, imageInputTokens, outputTokens } = input.tokens;
    return (
      (inputTokens / 1_000_000) * pricing.tokens.textInputPerM +
      (imageInputTokens / 1_000_000) * pricing.tokens.imageInputPerM +
      (outputTokens / 1_000_000) * pricing.tokens.outputPerM
    );
  }

  return pricing.flatHigh[input.size];
}

/** Aggregate written to `image_runs.image_usage` by finalize. */
export type ImageRunUsage = {
  imageCount: number;
  doneCount: number;
  failedCount: number;
  costUsd: number;
  durationMs: number;
};
