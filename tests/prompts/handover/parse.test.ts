import { describe, expect, test } from "vitest";
import {
  HANDOVER_DOC_MIN_WORDS,
  HandoverParseError,
  countPlaceholders,
  countWords,
  parseHandoverDoc,
} from "@/prompts/handover/parse";

// countWords counts whitespace-separated runs, so the title contributes
// 3 "words": "#", "Launch", "Handover".
const TITLE = "# Launch Handover";
const TITLE_WORDS = 3;

function fillerWords(count: number): string {
  return Array.from({ length: count }, (_, i) => `word${i}`).join(" ");
}

function docWithTotalWords(total: number): string {
  return `${TITLE}\n\n${fillerWords(total - TITLE_WORDS)}`;
}

describe("parseHandoverDoc — happy path", () => {
  test("valid doc: content preserved, word count computed, no placeholders", () => {
    const doc = docWithTotalWords(253);
    expect(parseHandoverDoc(doc)).toEqual({
      contentMd: doc,
      wordCount: 253,
      placeholderCount: 0,
    });
  });

  test("counts [[...]] placeholder occurrences", () => {
    // Appended tail adds 7 whitespace-separated tokens and 2 placeholders.
    const doc =
      docWithTotalWords(250) + "\n\n[[CREATOR STORY: fill me]] and [[EVENT DATE]]";
    expect(parseHandoverDoc(doc)).toEqual({
      contentMd: doc,
      wordCount: 257,
      placeholderCount: 2,
    });
  });

  test("exactly the minimum word count passes", () => {
    expect(HANDOVER_DOC_MIN_WORDS).toBe(200);
    const doc = docWithTotalWords(HANDOVER_DOC_MIN_WORDS);
    expect(parseHandoverDoc(doc).wordCount).toBe(HANDOVER_DOC_MIN_WORDS);
  });
});

describe("parseHandoverDoc — fence stripping", () => {
  const doc = docWithTotalWords(210);

  test.each([["```markdown"], ["```md"], ["```"]])(
    "strips a wrapping %s fence and preserves the inner content exactly",
    (opener) => {
      const wrapped = `${opener}\n${doc}\n\`\`\``;
      expect(parseHandoverDoc(wrapped).contentMd).toBe(doc);
    },
  );

  test("a fence-wrapped empty body still counts as an empty response", () => {
    expect(() => parseHandoverDoc("```\n\n```")).toThrow(HandoverParseError);
    expect(() => parseHandoverDoc("```\n\n```")).toThrow(/empty response/);
  });
});

describe("parseHandoverDoc — rejections", () => {
  test.each([
    ["empty string", "", /empty response/],
    ["whitespace-only", "   \n\t  ", /empty response/],
    [
      "missing '# ' title heading",
      `Launch Handover\n\n${fillerWords(250)}`,
      /does not start with a '# ' title heading/,
    ],
    [
      "short doc reports its word count and the minimum",
      "# Short doc\n\nnot enough words here",
      /response too short: 7 words \(min 200\)/,
    ],
    [
      "one word under the minimum",
      docWithTotalWords(HANDOVER_DOC_MIN_WORDS - 1),
      /response too short: 199 words \(min 200\)/,
    ],
    [
      "unclosed [[ at the end",
      docWithTotalWords(210) + "\n\n[[CREATOR STORY: truncated mid",
      /unclosed \[\[ placeholder token/,
    ],
    [
      "closed [[x]] followed by a later unclosed [[",
      docWithTotalWords(210) + "\n\n[[PROOF: real]] and then [[EVENT",
      /unclosed \[\[ placeholder token/,
    ],
  ])("throws HandoverParseError: %s", (_label, input, message) => {
    expect(() => parseHandoverDoc(input)).toThrow(HandoverParseError);
    expect(() => parseHandoverDoc(input)).toThrow(message);
  });
});

describe("countWords", () => {
  test.each([
    ["", 0],
    ["   \n\t ", 0],
    ["one two\nthree", 3],
  ])("%j → %i", (input, expected) => {
    expect(countWords(input)).toBe(expected);
  });
});

describe("countPlaceholders", () => {
  test.each([
    ["", 0],
    ["[[A]] [[B: c]]", 2],
    ["[[]]", 0],
    ["[[A]", 0],
  ])("%j → %i", (input, expected) => {
    expect(countPlaceholders(input)).toBe(expected);
  });
});
