import { describe, expect, test } from "vitest";
import {
  FALLBACK_INTRO_CATEGORY,
  FIRST_POST_BODY_MAX,
  FIRST_POST_BODY_TARGET,
  FIRST_POST_TITLE_MAX,
  FirstPostSchema,
  buildUserMessage,
  parseOutput,
  systemPrompt,
} from "@/prompts/first-post";
import { CapViolationError } from "@/lib/inngest/cap-violation";
import type { GeneratorInput, CreatorContext } from "@/types/generators";

const VALID_OUTPUT = {
  title: "Welcome to Story Medicine Writers 📜❤️",
  body: "Hello soul-led writers — so glad you found this space.\n\nThis community exists for the writers who feel the call to tell story-medicine, the kind that heals as it's read.\n\n🛑 PLEASE READ before you dive in.\n\n👉 Introduce yourself\n  - Open the Introductions category\n  - Tell us your name + one story you carry\n  - Hit Post\n\n👉 Engage with at least 2 posts\n  - Leave thoughtful comments\n  - Land in real connection from day one\n\n👉 Explore the Classroom\n  - The foundations live here\n  - Start at the top, work your way down\n\n👉 Download the Skool mobile app\n  - Notifications, on the go\n\nWith warmth — Ramsha",
};

function makeCreator(): CreatorContext {
  return {
    name: "Ramsha",
    community_name: "Story Medicine Writers",
    niche: "spiritual",
    audience: "soul-led writers",
    transformation: "tell the story-medicine you carry",
    tone: "warm",
    offer_breakdown: { perks: [], guest_sessions: false },
    pricing: { additional_tiers: [] },
    trial_terms: { has_trial: false, duration_days: 7 as const },
    refund_policy: "",
    support_contact: "support@example.test",
    brand_prefs: "",
    classroom_titles: ["Foundations"],
    calendar_intake: {
      events: [
        {
          title: "Weekly Story Circle",
          schedule: {
            type: "weekly",
            dayOfWeek: "mon",
            time: "19:00",
            timezone: "America/New_York",
          },
        },
      ],
    },
  };
}

function makeInput(): GeneratorInput {
  return {
    creator: makeCreator(),
    patternLibrary: [],
  };
}

describe("FirstPostSchema", () => {
  test("accepts the canonical shape", () => {
    expect(FirstPostSchema.safeParse(VALID_OUTPUT).success).toBe(true);
  });

  test("rejects an empty title", () => {
    expect(
      FirstPostSchema.safeParse({ ...VALID_OUTPUT, title: "" }).success,
    ).toBe(false);
  });

  test(`rejects a title over ${FIRST_POST_TITLE_MAX} chars`, () => {
    expect(
      FirstPostSchema.safeParse({
        ...VALID_OUTPUT,
        title: "a".repeat(FIRST_POST_TITLE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  test(`rejects a body over ${FIRST_POST_BODY_MAX} chars`, () => {
    expect(
      FirstPostSchema.safeParse({
        ...VALID_OUTPUT,
        body: "x".repeat(FIRST_POST_BODY_MAX + 1),
      }).success,
    ).toBe(false);
  });

  test("rejects empty body", () => {
    expect(
      FirstPostSchema.safeParse({ ...VALID_OUTPUT, body: "" }).success,
    ).toBe(false);
  });
});

describe("first-post systemPrompt", () => {
  test("documents the 6-part skeleton", () => {
    expect(systemPrompt).toMatch(/Warm opener/i);
    expect(systemPrompt).toMatch(/PLEASE READ/);
    expect(systemPrompt).toMatch(/Action items block/i);
    expect(systemPrompt).toMatch(/Introduce yourself/);
    expect(systemPrompt).toMatch(/Engage with at least 2 posts/);
    expect(systemPrompt).toMatch(/Explore the Classroom/);
    expect(systemPrompt).toMatch(/Skool mobile app/);
    expect(systemPrompt).toMatch(/Closing emotional line/i);
  });

  test("forbids merge tags", () => {
    expect(systemPrompt).toMatch(/DO NOT use merge tags/);
    expect(systemPrompt).toMatch(/no #NAME#, no #GROUPNAME#/);
  });

  test("threads the body length cap into the constraint block", () => {
    expect(systemPrompt).toContain(`${FIRST_POST_BODY_TARGET}`);
    expect(systemPrompt).toContain(`${FIRST_POST_BODY_MAX}`);
  });
});

describe("buildUserMessage", () => {
  test("includes the literal INTRO_CATEGORY variable", () => {
    const msg = buildUserMessage({
      input: makeInput(),
      introCategoryName: "Story Circles",
      hasCalendarEvents: true,
    });
    expect(msg).toContain('INTRO_CATEGORY = "Story Circles"');
  });

  test("flags INCLUDE when calendar events exist", () => {
    const msg = buildUserMessage({
      input: makeInput(),
      introCategoryName: FALLBACK_INTRO_CATEGORY,
      hasCalendarEvents: true,
    });
    expect(msg).toMatch(/INCLUDE the "Add the community events/);
    expect(msg).not.toMatch(/OMIT the "Add the community events/);
  });

  test("flags OMIT when there are no calendar events", () => {
    const msg = buildUserMessage({
      input: makeInput(),
      introCategoryName: FALLBACK_INTRO_CATEGORY,
      hasCalendarEvents: false,
    });
    expect(msg).toMatch(/OMIT the "Add the community events/);
    expect(msg).not.toMatch(/INCLUDE the "Add the community events/);
  });

  test("bakes the community name as a literal string into the task line", () => {
    const msg = buildUserMessage({
      input: makeInput(),
      introCategoryName: "Welcome",
      hasCalendarEvents: false,
    });
    expect(msg).toContain('"Story Medicine Writers"');
  });
});

describe("parseOutput", () => {
  test("parses the JSON inside <first_post_json> tags", () => {
    const raw = `Some preamble.
<first_post_json>
${JSON.stringify(VALID_OUTPUT)}
</first_post_json>
trailing`;
    const out = parseOutput(raw);
    expect(out.title).toBe(VALID_OUTPUT.title);
    expect(out.body).toBe(VALID_OUTPUT.body);
  });

  test("recovers via first-newline split when the JSON tags are missing", () => {
    const raw = `Welcome to Story Medicine Writers 📜\nFirst paragraph of the body.\nSecond paragraph.`;
    const out = parseOutput(raw);
    expect(out.title).toBe("Welcome to Story Medicine Writers 📜");
    expect(out.body).toMatch(/^First paragraph/);
  });

  test("recovers via first-newline split when the JSON inside the tag is malformed", () => {
    const raw = `<first_post_json>not json at all
just a body</first_post_json>`;
    // Falls through to recovery split — first line = title.
    const out = parseOutput(raw);
    expect(out.title).toBe("<first_post_json>not json at all");
    expect(out.body).toBe("just a body</first_post_json>");
  });

  test("throws when the output has no newline and no JSON tag", () => {
    expect(() => parseOutput("just a single line, no body")).toThrow(
      /no <first_post_json> tag and no newline/,
    );
  });

  test("throws CapViolationError on body over the cap (retry-eligible)", () => {
    const oversized = {
      title: "Welcome",
      body: "x".repeat(FIRST_POST_BODY_MAX + 50),
    };
    const raw = `<first_post_json>${JSON.stringify(oversized)}</first_post_json>`;
    let caught: unknown;
    try {
      parseOutput(raw);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CapViolationError);
    const err = caught as CapViolationError;
    expect(err.module).toBe("first_post");
    expect(err.maxChars).toBe(FIRST_POST_BODY_MAX);
    expect(err.actualChars).toBeGreaterThan(FIRST_POST_BODY_MAX);
  });
});
