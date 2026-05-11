import { describe, expect, test } from "vitest";
import { buildIconPrompt, ICON_STYLES } from "@/prompts/icon";
import type { CreatorContext } from "@/types/generators";

function makeCreator(overrides: Partial<CreatorContext> = {}): CreatorContext {
  return {
    name: "Jane Doe",
    community_name: "Soul Collective",
    niche: "spiritual",
    audience: "women 30-55",
    transformation: "reclaim your power",
    tone: "warm",
    offer_breakdown: {
      courses: [],
      perks: [],
      events: [],
      guest_sessions: false,
    },
    pricing: { monthly: 47, annual: 470, tiers: [] },
    trial_terms: { has_trial: false },
    refund_policy: "",
    support_contact: "support@test",
    brand_prefs: "",
    creator_photo_url: undefined,
    ...overrides,
  };
}

describe("buildIconPrompt", () => {
  test("ICON_STYLES exposes exactly three styles", () => {
    expect(ICON_STYLES).toEqual(["geometric", "typographic", "iconic"]);
  });

  test.each(ICON_STYLES)("returns a non-empty prompt for style=%s", (style) => {
    const prompt = buildIconPrompt({ creator: makeCreator(), style });
    expect(prompt.length).toBeGreaterThan(200);
  });

  test("includes community name and 1:1 (512x512) aspect", () => {
    const prompt = buildIconPrompt({
      creator: makeCreator({ community_name: "Alchemy Circle" }),
      style: "geometric",
    });
    expect(prompt).toContain('"Alchemy Circle"');
    expect(prompt).toContain("1:1 (512x512)");
  });

  test("each style produces a visually distinct prompt", () => {
    const prompts = ICON_STYLES.map((style) =>
      buildIconPrompt({ creator: makeCreator(), style }),
    );
    expect(new Set(prompts).size).toBe(ICON_STYLES.length);
  });

  test("includes the no-gibberish guardrail and refers to the transformation", () => {
    const prompt = buildIconPrompt({
      creator: makeCreator({ transformation: "build a sustainable practice" }),
      style: "iconic",
    });
    expect(prompt).toMatch(/no gibberish/i);
    expect(prompt).toContain('"build a sustainable practice"');
  });

  test("forbids photographs of people for any style", () => {
    for (const style of ICON_STYLES) {
      const prompt = buildIconPrompt({ creator: makeCreator(), style });
      expect(prompt).toMatch(/no photographs of people/i);
    }
  });
});
