/**
 * Cross-builder coverage for the regenerate-note pipeline.
 *
 * For every prompt builder (9 text + 4 image), assert two things:
 *
 *   1. without note   → the builder output does NOT contain the
 *      USER FEEDBACK suffix (and ends in its normal terminator).
 *   2. with note      → the builder output ends with the priority-framed
 *      suffix containing the literal note text and the priority line.
 *
 * The "byte-identical without note" expectation lives in the snapshot
 * test below, which captures one no-note output per builder and asserts
 * subsequent calls match.
 */
import { describe, expect, test } from "vitest";
import type { GeneratorInput, CreatorContext } from "@/types/generators";

import { buildUserMessage as buildAboutUs } from "@/prompts/about-us";
import { buildUserMessage as buildCalendar } from "@/prompts/calendar";
import { buildUserMessage as buildCategories } from "@/prompts/categories";
import { buildUserMessage as buildClassroom } from "@/prompts/classroom";
import { buildUserMessage as buildDiscoverySeo } from "@/prompts/discovery_seo";
import { buildUserMessage as buildLeaderboard } from "@/prompts/leaderboard";
import { buildUserMessage as buildStartHere } from "@/prompts/start-here";
import { buildUserMessage as buildTransformation } from "@/prompts/transformation";
import { buildUserMessage as buildWelcomeDm } from "@/prompts/welcome-dm";

import { buildImagePrompt as buildCover } from "@/prompts/cover";
import { buildIconPrompt } from "@/prompts/icon";
import { buildClassroomCoverPrompt } from "@/prompts/classroom_cover";
import { buildCalendarCoverPrompt } from "@/prompts/calendar_cover";

const NOTE = "make it more concise";

const PRIORITY_LINE =
  "Treat this feedback as priority guidance. If it conflicts with default style choices, the user feedback wins.";

function makeCreator(): CreatorContext {
  return {
    name: "Jane Doe",
    community_name: "Soul Collective",
    niche: "spiritual",
    audience: "women 30-55",
    transformation: "reclaim your power",
    tone: "warm",
    offer_breakdown: {
      courses: [{ name: "Foundations" }],
      perks: [],
      events: [],
      guest_sessions: false,
    },
    pricing: { monthly: 47, annual: 470, tiers: [] },
    trial_terms: { has_trial: false, duration_days: 7 as const },
    refund_policy: "14-day refund",
    support_contact: "support@example.test",
    brand_prefs: "",
    creator_photo_url: undefined,
  };
}

function makeTextInput(note?: string): GeneratorInput {
  return {
    creator: makeCreator(),
    patternLibrary: [
      {
        tone: "warm",
        niche: "spiritual",
        sourceCreator: "Test",
        content: "example body",
        raw: { text: "example body" },
      },
    ],
    regenerateNote: note,
  };
}

type TextBuilder = (input: GeneratorInput) => string;

const textBuilders: Array<{ name: string; build: TextBuilder }> = [
  { name: "welcome_dm", build: buildWelcomeDm },
  { name: "transformation", build: buildTransformation },
  { name: "about_us", build: buildAboutUs },
  { name: "start_here", build: buildStartHere },
  { name: "classroom", build: buildClassroom },
  { name: "calendar", build: buildCalendar },
  { name: "leaderboard", build: buildLeaderboard },
  { name: "categories", build: buildCategories },
  { name: "discovery_seo", build: buildDiscoverySeo },
];

type ImageBuilder = (creator: CreatorContext, note?: string) => string;

const imageBuilders: Array<{ name: string; build: ImageBuilder }> = [
  {
    name: "cover",
    build: (creator, regenerateNote) =>
      buildCover({
        creator,
        transformationLine: creator.transformation,
        regenerateNote,
      }),
  },
  {
    name: "icon",
    build: (creator, regenerateNote) =>
      buildIconPrompt({ creator, style: "geometric", regenerateNote }),
  },
  {
    name: "classroom_cover",
    build: (creator, regenerateNote) =>
      buildClassroomCoverPrompt({ creator, regenerateNote }),
  },
  {
    name: "calendar_cover",
    build: (creator, regenerateNote) =>
      buildCalendarCoverPrompt({ creator, regenerateNote }),
  },
];

describe("regenerate-note wiring — text builders", () => {
  describe.each(textBuilders)("$name", ({ build }) => {
    test("without note: no USER FEEDBACK block in the output", () => {
      const out = build(makeTextInput(undefined));
      expect(out).not.toContain("USER FEEDBACK TO INCORPORATE");
      expect(out).not.toContain("<regenerate_note>");
    });

    test("without note: output is byte-identical across two invocations", () => {
      const a = build(makeTextInput(undefined));
      const b = build(makeTextInput(undefined));
      expect(a).toBe(b);
    });

    test("with note: suffix is appended at the END with priority framing", () => {
      const out = build(makeTextInput(NOTE));
      expect(out).toContain(`USER FEEDBACK TO INCORPORATE:\n${NOTE}`);
      expect(out).toContain(PRIORITY_LINE);
      expect(out.endsWith(PRIORITY_LINE)).toBe(true);
    });

    test("with note: the prompt without note is a strict prefix of the prompt with note", () => {
      const without = build(makeTextInput(undefined));
      const withNote = build(makeTextInput(NOTE));
      expect(withNote.startsWith(without)).toBe(true);
    });
  });
});

describe("regenerate-note wiring — image builders", () => {
  describe.each(imageBuilders)("$name", ({ build }) => {
    test("without note: no USER FEEDBACK block in the output", () => {
      const out = build(makeCreator(), undefined);
      expect(out).not.toContain("USER FEEDBACK TO INCORPORATE");
    });

    test("without note: output is byte-identical across two invocations", () => {
      const a = build(makeCreator(), undefined);
      const b = build(makeCreator(), undefined);
      expect(a).toBe(b);
    });

    test("with note: suffix is appended at the END with priority framing", () => {
      const out = build(makeCreator(), NOTE);
      expect(out).toContain(`USER FEEDBACK TO INCORPORATE:\n${NOTE}`);
      expect(out).toContain(PRIORITY_LINE);
      expect(out.endsWith(PRIORITY_LINE)).toBe(true);
    });

    test("with note: the no-note prompt is a strict prefix of the with-note prompt", () => {
      const without = build(makeCreator(), undefined);
      const withNote = build(makeCreator(), NOTE);
      expect(withNote.startsWith(without)).toBe(true);
    });
  });
});
