import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generationJobs } from "@/lib/db/schema";

/**
 * Claude pricing (as of 2026-08). Kept here as a single source of truth;
 * bump if Anthropic's pricing page changes. Cost is per 1M tokens.
 *
 * Sonnet 4.6 pricing: $3 input / $15 output per 1M tokens (unchanged from 4.5).
 * Opus 4.8 (handover generation): $5 / $25, cache read $0.50, cache write
 * $6.25 (5-min ephemeral TTL).
 */
type PricingRates = {
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM?: number;
  cacheWritePerM?: number;
};

const PRICING: Record<string, PricingRates> = {
  "claude-sonnet-4-6": { inputPerM: 3, outputPerM: 15 },
  "claude-opus-4-5": { inputPerM: 15, outputPerM: 75 },
  "claude-opus-4-8": {
    inputPerM: 5,
    outputPerM: 25,
    cacheReadPerM: 0.5,
    cacheWritePerM: 6.25,
  },
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5 },
};

type ModelId = keyof typeof PRICING;

export type ClaudeUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number;
};

/**
 * Cache token classes default to 0 so existing 3-arg call sites are
 * unchanged. When a model has no explicit cache rates (we've never enabled
 * caching for it), estimates fall back to Anthropic's standard ratios:
 * cache read = 10% of input, cache write = 1.25x input.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number {
  const rates = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  const inCost = (inputTokens / 1_000_000) * rates.inputPerM;
  const outCost = (outputTokens / 1_000_000) * rates.outputPerM;
  const cacheReadCost =
    (cacheReadTokens / 1_000_000) * (rates.cacheReadPerM ?? rates.inputPerM * 0.1);
  const cacheWriteCost =
    (cacheWriteTokens / 1_000_000) *
    (rates.cacheWritePerM ?? rates.inputPerM * 1.25);
  return Number(
    (inCost + outCost + cacheReadCost + cacheWriteCost).toFixed(6),
  );
}

/**
 * Persist usage to `generation_jobs.claude_usage`. Swallows errors — a
 * broken logger should never tank a generation.
 */
export async function logClaudeUsage(params: {
  jobId: string;
  model: ModelId | string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}): Promise<void> {
  try {
    const costUsd = estimateCostUsd(
      params.model,
      params.inputTokens,
      params.outputTokens,
    );
    const payload: ClaudeUsage = {
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      durationMs: params.durationMs,
      costUsd,
    };
    await db
      .update(generationJobs)
      .set({ claudeUsage: payload })
      .where(eq(generationJobs.id, params.jobId));
  } catch (err) {
    // Never throw — the caller's generation succeeded; accounting is best-effort.
    console.error("[claude/usage] logging failed:", err);
  }
}
