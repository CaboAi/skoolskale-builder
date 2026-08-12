import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd } from "./usage";
import type { HandoverSystemBlock } from "@/prompts/handover/system-blocks";

/**
 * Opus wrapper for handover deliverables — deliberately separate from
 * generate.ts (which stays on the Vercel AI SDK for the module generators).
 * This path uses the raw Anthropic SDK because the proven DFY request shape
 * needs three things the AI SDK can't cleanly express: a system BLOCK ARRAY
 * with cache_control on the last block, adaptive thinking, and effort
 * config. Cache hits depend on byte-identical prefixes, so no translation
 * layer between our blocks and the wire format.
 */

export const HANDOVER_MODEL = "claude-opus-4-8";
export const HANDOVER_MAX_TOKENS = 16000;

/**
 * Same base-URL pinning rationale as generate.ts — the SDK reads
 * `ANTHROPIC_BASE_URL` when unset and some environments inject a malformed
 * value — but note the DIFFERENT value: the raw SDK appends the full
 * `/v1/messages` path itself, so the origin must NOT carry `/v1`. The AI
 * SDK provider in generate.ts appends only `/messages`, which is why that
 * one is pinned to `.../v1`. Passing `/v1` here yields `/v1/v1/messages`
 * and a 404 on every call.
 */
function client(): Anthropic {
  return new Anthropic({ baseURL: "https://api.anthropic.com" });
}

export type HandoverClaudeUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  costUsd: number;
};

export type GenerateHandoverResult = {
  text: string;
  usage: HandoverClaudeUsage;
};

/**
 * One deliverable call. Streaming (not one-shot) because 16K-token Opus
 * responses run minutes and would trip idle HTTP timeouts. No retries here —
 * the Inngest step owns retries, and a step retry re-reads the prompt cache
 * at ~10% of input price.
 */
export async function generateHandoverDoc(params: {
  systemBlocks: HandoverSystemBlock[];
  userMessage: string;
  maxTokens?: number;
}): Promise<GenerateHandoverResult> {
  const start = Date.now();
  const stream = client().messages.stream({
    model: HANDOVER_MODEL,
    max_tokens: params.maxTokens ?? HANDOVER_MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: params.systemBlocks,
    messages: [{ role: "user", content: params.userMessage }],
  } as Anthropic.MessageStreamParams);
  const message = await stream.finalMessage();
  const durationMs = Date.now() - start;

  const text = message.content
    .filter(
      (block): block is Anthropic.TextBlock => block.type === "text",
    )
    .map((block) => block.text)
    .join("");

  const usage = message.usage;
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

  return {
    text,
    usage: {
      model: HANDOVER_MODEL,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      durationMs,
      costUsd: estimateCostUsd(
        HANDOVER_MODEL,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
      ),
    },
  };
}
