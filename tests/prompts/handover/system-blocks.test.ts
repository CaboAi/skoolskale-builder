import { describe, expect, test } from "vitest";
import { formatBrief } from "@/prompts/handover/brief";
import { buildHandoverSystemBlocks } from "@/prompts/handover/system-blocks";
import { FULL_BRIEF } from "./fixtures";

const PARAMS = {
  brief: FULL_BRIEF,
  dnaMarkdown: "# Soul Collective DNA\n\nEvery fact lives here.",
  guardrailsText: "GUARDRAILS REFERENCE BODY — never fabricate.",
  structureText: "STRUCTURE REFERENCE BODY — the six-file package.",
};

describe("buildHandoverSystemBlocks", () => {
  test("returns exactly 5 text blocks", () => {
    const blocks = buildHandoverSystemBlocks(PARAMS);
    expect(blocks).toHaveLength(5);
    expect(blocks.map((b) => b.type)).toEqual([
      "text",
      "text",
      "text",
      "text",
      "text",
    ]);
  });

  test("block 1 is the copywriter role", () => {
    const blocks = buildHandoverSystemBlocks(PARAMS);
    expect(
      blocks[0].text.startsWith(
        "You are an expert direct-response copywriter",
      ),
    ).toBe(true);
  });

  test("block 2 is the guardrails header + the passed text verbatim", () => {
    const blocks = buildHandoverSystemBlocks(PARAMS);
    expect(blocks[1].text).toBe(
      "FULL VOICE & GUARDRAILS REFERENCE:\n\n" + PARAMS.guardrailsText,
    );
  });

  test("block 3 embeds the structure text under the deliverable-set framing", () => {
    const blocks = buildHandoverSystemBlocks(PARAMS);
    expect(blocks[2].text.startsWith("THE FULL DELIVERABLE SET")).toBe(true);
    expect(blocks[2].text.endsWith("\n\n" + PARAMS.structureText)).toBe(true);
  });

  test("block 4 is exactly the formatted brief", () => {
    const blocks = buildHandoverSystemBlocks(PARAMS);
    expect(blocks[3].text).toBe(formatBrief(FULL_BRIEF));
  });

  test("block 5 embeds the DNA markdown verbatim", () => {
    const blocks = buildHandoverSystemBlocks(PARAMS);
    expect(blocks[4].text).toBe(
      "THIS COMMUNITY'S PRE-SKOOL DNA (the source of truth for every fact):\n\n" +
        PARAMS.dnaMarkdown,
    );
  });

  test("only the last block carries the ephemeral cache_control breakpoint", () => {
    const blocks = buildHandoverSystemBlocks(PARAMS);
    expect(blocks[4].cache_control).toEqual({ type: "ephemeral" });
    for (const block of blocks.slice(0, 4)) {
      expect(block.cache_control).toBeUndefined();
    }
  });

  test("deterministic: two calls with identical inputs deep-equal", () => {
    expect(buildHandoverSystemBlocks(PARAMS)).toEqual(
      buildHandoverSystemBlocks({ ...PARAMS }),
    );
  });
});
