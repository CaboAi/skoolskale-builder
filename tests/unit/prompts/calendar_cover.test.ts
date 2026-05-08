import { describe, expect, test } from "vitest";
import { buildCalendarCoverPrompt } from "@/prompts/calendar_cover";
import type { CreatorContext } from "@/types/generators";

function makeCreator(overrides: Partial<CreatorContext> = {}): CreatorContext {
  return {
    name: "Jane Doe",
    community_name: "Soul Collective",
    niche: "spiritual",
    audience: "women 30-55",
    transformation: "reclaim your power",
    tone: "loving",
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

describe("buildCalendarCoverPrompt", () => {
  const niches: CreatorContext["niche"][] = [
    "spiritual",
    "yoga",
    "relationships",
    "business",
    "money",
    "fitness",
    "other",
  ];

  test.each(niches)("returns a non-empty prompt for niche=%s", (niche) => {
    const prompt = buildCalendarCoverPrompt({
      creator: makeCreator({ niche }),
    });
    expect(prompt.length).toBeGreaterThan(200);
  });

  test("includes Calendar title text and community name", () => {
    const prompt = buildCalendarCoverPrompt({
      creator: makeCreator({ community_name: "Alchemy Circle" }),
    });
    expect(prompt).toContain('"Calendar"');
    expect(prompt).toContain('"Alchemy Circle"');
  });

  test("declares 16:9 (1456x816) aspect ratio for sectional banner use", () => {
    const prompt = buildCalendarCoverPrompt({ creator: makeCreator() });
    expect(prompt).toContain("16:9 (1456x816)");
  });

  test("includes guardrails: no people photos, no gibberish, exact spellings", () => {
    const prompt = buildCalendarCoverPrompt({ creator: makeCreator() });
    expect(prompt).toMatch(/no photographs of identifiable people/i);
    expect(prompt).toMatch(/no gibberish/i);
    expect(prompt).toMatch(/spelled exactly/i);
  });
});
