import { describe, expect, test } from "vitest";
import {
  buildHumanizeSystemBlocks,
  buildHumanizeUserPrompt,
  checkHumanizedDoc,
  placeholderLabels,
} from "@/prompts/handover/humanize";
import { countWords, HANDOVER_DOC_MIN_WORDS } from "@/prompts/handover/parse";

/**
 * A document long enough to clear the parser's word floor, so length never
 * silently explains a failure the test means to attribute to something else.
 */
function doc(body: string, filler = HANDOVER_DOC_MIN_WORDS): string {
  const words = Array.from({ length: filler }, (_, i) => `word${i}`).join(" ");
  return `# Community — VSL\n\n${body}\n\n${words}`;
}

const ORIGINAL = doc(
  "I'm [[CREATOR STORY: the turning point]] and it cost [[REAL NUMBER: years]].",
);

describe("placeholderLabels", () => {
  test("normalizes on the label before the first colon", () => {
    expect(placeholderLabels("[[CREATOR STORY: a]] and [[CREATOR STORY: b]]")).toEqual(
      new Set(["CREATOR STORY"]),
    );
  });

  test("collects distinct labels and ignores unbracketed text", () => {
    expect(
      placeholderLabels("[[PROOF: x]] plain [[EVENT DATE]] more [[N]]"),
    ).toEqual(new Set(["PROOF", "EVENT DATE", "N"]));
  });

  test("a document with no tokens yields an empty set", () => {
    expect(placeholderLabels("no tokens at all")).toEqual(new Set());
  });
});

describe("checkHumanizedDoc", () => {
  test("accepts a rewrite that keeps the heading and every placeholder", () => {
    const rewritten = doc(
      "Here is what happened. [[CREATOR STORY: the turning point]] took [[REAL NUMBER: years]].",
    );
    expect(checkHumanizedDoc(ORIGINAL, rewritten)).toEqual({ ok: true });
  });

  test("rejects a rewrite that dropped a placeholder the checklist needs", () => {
    const rewritten = doc("I'm [[CREATOR STORY: the turning point]] and it cost me.");
    expect(checkHumanizedDoc(ORIGINAL, rewritten)).toEqual({
      ok: false,
      reason: "rewrite dropped placeholder(s): REAL NUMBER",
    });
  });

  test("names every dropped placeholder, sorted", () => {
    expect(checkHumanizedDoc(ORIGINAL, doc("nothing left to fill in"))).toEqual({
      ok: false,
      reason: "rewrite dropped placeholder(s): CREATOR STORY, REAL NUMBER",
    });
  });

  test("rejects a rewrite that invented a placeholder", () => {
    const rewritten = doc(
      "[[CREATOR STORY: x]] [[REAL NUMBER: y]] and [[TESTIMONIAL: made up]].",
    );
    expect(checkHumanizedDoc(ORIGINAL, rewritten)).toEqual({
      ok: false,
      reason: "rewrite invented placeholder(s): TESTIMONIAL",
    });
  });

  test("rejects a rewrite that lost the title heading the parser requires", () => {
    const rewritten = ORIGINAL.replace("# Community — VSL", "Community — VSL");
    expect(checkHumanizedDoc(ORIGINAL, rewritten)).toEqual({
      ok: false,
      reason: "rewrite lost its '# ' title heading",
    });
  });

  test("rejects an empty rewrite", () => {
    expect(checkHumanizedDoc(ORIGINAL, "   ")).toEqual({
      ok: false,
      reason: "empty rewrite",
    });
  });

  test("rejects a rewrite under the parser's word floor", () => {
    const short = "# Community — VSL\n\n[[CREATOR STORY: x]] [[REAL NUMBER: y]]";
    expect(countWords(short)).toBeLessThan(HANDOVER_DOC_MIN_WORDS);
    expect(checkHumanizedDoc(ORIGINAL, short)).toEqual({
      ok: false,
      reason: `rewrite too short: ${countWords(short)} words`,
    });
  });

  test("rejects a summary: over half the words gone", () => {
    const long = doc("[[CREATOR STORY: x]] [[REAL NUMBER: y]]", 600);
    const half = doc("[[CREATOR STORY: x]] [[REAL NUMBER: y]]", 200);
    expect(countWords(half)).toBeLessThan(countWords(long) * 0.5);
    expect(checkHumanizedDoc(long, half)).toEqual({
      ok: false,
      reason: `rewrite cut too much: ${countWords(half)} of ${countWords(long)} words`,
    });
  });

  test("accepts ordinary tightening that stays above the half-length floor", () => {
    const long = doc("[[CREATOR STORY: x]] [[REAL NUMBER: y]]", 600);
    const trimmed = doc("[[CREATOR STORY: x]] [[REAL NUMBER: y]]", 400);
    expect(countWords(trimmed)).toBeGreaterThan(countWords(long) * 0.5);
    expect(checkHumanizedDoc(long, trimmed)).toEqual({ ok: true });
  });
});

describe("buildHumanizeSystemBlocks", () => {
  const blocks = buildHumanizeSystemBlocks({
    humanizerSkill: "SKILL BODY",
    dnaMarkdown: "DNA BODY",
  });

  test("embeds the skill and the DNA voice sample verbatim", () => {
    expect(blocks.map((b) => b.text)).toContain("SKILL BODY");
    expect(blocks.at(-1)?.text).toContain("DNA BODY");
  });

  test("caches on the last block only, matching the generation call", () => {
    expect(blocks.filter((b) => b.cache_control !== undefined)).toHaveLength(1);
    expect(blocks.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
  });

  test("the contract outranks the skill on headings and placeholders", () => {
    const contract = blocks.map((b) => b.text).join("\n");
    expect(contract).toContain("outranks every rule in the skill above");
    expect(contract).toContain("heading STRUCTURE exactly");
    expect(contract).toContain("{{firstName}}");
  });
});

describe("buildHumanizeUserPrompt", () => {
  test("carries the document title and its full body", () => {
    const out = buildHumanizeUserPrompt({
      docTitle: "VSL + Cancellation",
      contentMd: ORIGINAL,
    });
    expect(out).toContain('"VSL + Cancellation"');
    expect(out).toContain(ORIGINAL);
  });
});
