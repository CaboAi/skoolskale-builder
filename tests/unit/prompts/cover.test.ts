import { describe, expect, test } from "vitest";
import { buildImagePrompt } from "@/prompts/cover";
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

describe("buildImagePrompt", () => {
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
    const prompt = buildImagePrompt({ creator: makeCreator({ niche }) });
    expect(prompt.length).toBeGreaterThan(200);
  });

  test("includes community name and 16:9 aspect ratio", () => {
    const prompt = buildImagePrompt({
      creator: makeCreator({ community_name: "Alchemy Circle" }),
    });
    expect(prompt).toContain('"Alchemy Circle"');
    expect(prompt).toContain("16:9");
  });

  test("spiritual/yoga/relationships default to illustrated; business/money/fitness default to photographic", () => {
    expect(
      buildImagePrompt({ creator: makeCreator({ niche: "spiritual" }) }),
    ).toContain("Illustrated style");
    expect(
      buildImagePrompt({ creator: makeCreator({ niche: "yoga" }) }),
    ).toContain("Illustrated style");
    expect(
      buildImagePrompt({ creator: makeCreator({ niche: "relationships" }) }),
    ).toContain("Illustrated style");

    expect(
      buildImagePrompt({ creator: makeCreator({ niche: "business" }) }),
    ).toContain("Photographic style");
    expect(
      buildImagePrompt({ creator: makeCreator({ niche: "money" }) }),
    ).toContain("Photographic style");
    expect(
      buildImagePrompt({ creator: makeCreator({ niche: "fitness" }) }),
    ).toContain("Photographic style");
  });

  test("styleOverride wins over the niche default", () => {
    // spiritual → illustrated by default; override to minimalist
    const prompt = buildImagePrompt({
      creator: makeCreator({ niche: "spiritual" }),
      styleOverride: "minimalist",
    });
    expect(prompt).toContain("Minimalist style");
    expect(prompt).not.toContain("Illustrated style");
  });

  test("includes the transformation tagline when provided", () => {
    const prompt = buildImagePrompt({
      creator: makeCreator(),
      transformationLine: "Reclaim your power.",
    });
    expect(prompt).toContain('"Reclaim your power."');
  });

  test("omits tagline block cleanly when transformationLine is missing", () => {
    const prompt = buildImagePrompt({ creator: makeCreator() });
    expect(prompt).toContain("No supporting text");
    expect(prompt).not.toMatch(/Supporting text.*:/);
  });

  test("includes the no-gibberish-text guardrail against AI-art artifacts", () => {
    const prompt = buildImagePrompt({ creator: makeCreator() });
    expect(prompt).toMatch(/no gibberish/i);
    expect(prompt).toMatch(/no malformed hands/i);
  });
});
