/**
 * Per-deliverable user prompt: framework reference + gold example(s) + task.
 * Port of cli/prompts.py build_user_prompt. The DNA and guardrails are NOT
 * repeated here — they live in the cached system blocks.
 *
 * Pure module.
 */
import type { HandoverDeliverable } from "./deliverables";

export function buildHandoverUserPrompt(params: {
  deliverable: HandoverDeliverable;
  referenceText: string;
  templateTexts: string[];
  includeGuestEmails: boolean;
}): string {
  const { deliverable, referenceText, templateTexts, includeGuestEmails } =
    params;
  const templateBlock = templateTexts
    .map(
      (t, i) =>
        `### Gold example ${i + 1} (structure/voice only — DO NOT copy verbatim; regenerate for this community)\n\n${t}`,
    )
    .join("\n\n");

  return `## The framework to follow

${referenceText}

## Gold-standard example(s)

${templateBlock}

## Your task — deliverable ${deliverable.num}: ${deliverable.title}

(Use the community facts and DNA already given above in the system prompt.)

${deliverable.buildTask(includeGuestEmails)}

Output ONLY the finished Markdown for this deliverable. No preamble, no sign-off from you,
no surrounding code fences.`;
}
