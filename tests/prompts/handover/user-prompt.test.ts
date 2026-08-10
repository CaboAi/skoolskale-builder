import { describe, expect, test } from "vitest";
import {
  HANDOVER_DELIVERABLES,
  type HandoverDeliverable,
  type HandoverGeneratedDocKey,
} from "@/prompts/handover/deliverables";
import { buildHandoverUserPrompt } from "@/prompts/handover/user-prompt";

const REFERENCE = "REFERENCE FRAMEWORK BODY — follow beats 1 through 9.";
const TEMPLATE_ONE = "GOLD EXAMPLE BODY ONE";
const TEMPLATE_TWO = "GOLD EXAMPLE BODY TWO";

const GOLD_HEADER = (n: number) =>
  `### Gold example ${n} (structure/voice only — DO NOT copy verbatim; regenerate for this community)`;

const FOOTER =
  "Output ONLY the finished Markdown for this deliverable. No preamble, no sign-off from you,\n" +
  "no surrounding code fences.";

function getDeliverable(docKey: HandoverGeneratedDocKey): HandoverDeliverable {
  const d = HANDOVER_DELIVERABLES.find((x) => x.docKey === docKey);
  if (!d) throw new Error(`deliverable ${docKey} missing from registry`);
  return d;
}

function build(
  docKey: HandoverGeneratedDocKey,
  templateTexts: string[],
  includeGuestEmails = false,
): string {
  return buildHandoverUserPrompt({
    deliverable: getDeliverable(docKey),
    referenceText: REFERENCE,
    templateTexts,
    includeGuestEmails,
  });
}

describe("buildHandoverUserPrompt", () => {
  test("embeds the framework reference verbatim under its heading", () => {
    const out = build("vsl_and_cancellation", [TEMPLATE_ONE]);
    expect(out).toContain(`## The framework to follow\n\n${REFERENCE}`);
  });

  test("numbers gold examples 1 and 2 for two templates, in order", () => {
    const out = build("pre_launch_emails", [TEMPLATE_ONE, TEMPLATE_TWO], true);
    expect(out).toContain(
      `${GOLD_HEADER(1)}\n\n${TEMPLATE_ONE}\n\n${GOLD_HEADER(2)}\n\n${TEMPLATE_TWO}`,
    );
  });

  test("a single template gets example 1 only", () => {
    const out = build("dm_sequences", [TEMPLATE_ONE]);
    expect(out).toContain(`${GOLD_HEADER(1)}\n\n${TEMPLATE_ONE}`);
    expect(out).not.toContain("### Gold example 2");
  });

  test("task heading carries the deliverable num and title", () => {
    const out = build("vsl_and_cancellation", [TEMPLATE_ONE]);
    expect(out).toContain("## Your task — deliverable 01: VSL + Cancellation");
  });

  test.each([false, true] as const)(
    "pre_launch_emails with includeGuestEmails=%j embeds buildTask(%j)",
    (flag) => {
      const out = build("pre_launch_emails", [TEMPLATE_ONE], flag);
      expect(out).toContain(
        getDeliverable("pre_launch_emails").buildTask(flag),
      );
      if (flag) {
        expect(out).toContain("CONFIRMED launch guests");
        expect(out).not.toContain("Do NOT produce a guest-speaker");
      } else {
        expect(out).toContain("Do NOT produce a guest-speaker");
        expect(out).not.toContain("CONFIRMED launch guests");
      }
    },
  );

  test("ends with the finished-Markdown-only footer", () => {
    for (const d of HANDOVER_DELIVERABLES) {
      const out = build(d.docKey, [TEMPLATE_ONE]);
      expect(out.endsWith(FOOTER)).toBe(true);
    }
  });
});
