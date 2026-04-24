import "server-only";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { logClaudeUsage } from "./usage";

/**
 * Default model. Change in one place; cost table in ./usage.ts keys off this.
 */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

export type GenerateParams = {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
  /**
   * The generation_jobs row id this call belongs to. Usage rows write here.
   * Optional for ad-hoc callers (CLIs, tests) — when omitted we skip logging.
   */
  jobId?: string;
};

export type GenerateResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

/**
 * Thin wrapper around the Vercel AI SDK's generateText against Claude.
 * - No retry logic here — Inngest owns retries at the step level.
 * - Usage logging is fire-and-forget; the generation's success is independent
 *   of whether the audit write succeeded.
 */
export async function generate(
  params: GenerateParams,
): Promise<GenerateResult> {
  const model = params.model ?? DEFAULT_MODEL;
  const start = Date.now();

  const result = await generateText({
    model: anthropic(model),
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userMessage }],
    ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
  });

  const durationMs = Date.now() - start;

  // AI SDK v5/v6 normalized usage fields. Fall back through a couple of names
  // so a bump of the SDK version doesn't silently zero our cost tracking.
  const usage = (result.usage ?? {}) as Partial<{
    inputTokens: number;
    outputTokens: number;
    promptTokens: number;
    completionTokens: number;
  }>;
  const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
  const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;

  if (params.jobId) {
    // Awaited but logClaudeUsage swallows its own errors.
    await logClaudeUsage({
      jobId: params.jobId,
      model,
      inputTokens,
      outputTokens,
      durationMs,
    });
  }

  return {
    text: result.text,
    model,
    inputTokens,
    outputTokens,
    durationMs,
  };
}
