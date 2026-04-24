import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generationJobs } from "@/lib/db/schema";

/**
 * Claude pricing (as of 2026-04). Kept here as a single source of truth;
 * bump if Anthropic's pricing page changes. Cost is per 1M tokens.
 *
 * Sonnet 4.6 pricing: $3 input / $15 output per 1M tokens (unchanged from 4.5).
 */
const PRICING = {
  "claude-sonnet-4-6": { inputPerM: 3, outputPerM: 15 },
  "claude-opus-4-5": { inputPerM: 15, outputPerM: 75 },
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5 },
} as const;

type ModelId = keyof typeof PRICING;

export type ClaudeUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number;
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates =
    (PRICING as Record<string, { inputPerM: number; outputPerM: number }>)[
      model
    ] ?? PRICING["claude-sonnet-4-6"];
  const inCost = (inputTokens / 1_000_000) * rates.inputPerM;
  const outCost = (outputTokens / 1_000_000) * rates.outputPerM;
  return Number((inCost + outCost).toFixed(6));
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
