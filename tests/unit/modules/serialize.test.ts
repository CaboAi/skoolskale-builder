import { describe, expect, test } from "vitest";
import type { Creator, GeneratedAsset } from "@/lib/db/schema";
import type { CalendarEvent } from "@/types/schemas";
import { formatSchedule } from "@/lib/calendar/format-schedule";
import {
  packageMarkdownFilename,
  serializeModuleText,
  serializePackageMarkdown,
} from "@/lib/modules/serialize";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");

function makeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Jane Doe",
    communityName: "The Calm Closer",
    niche: "business",
    audience: "B2B sales reps who dread cold calls",
    transformation: "From call reluctance to booked-out pipeline",
    tone: "warm",
    offerBreakdown: { perks: ["Weekly hot-seat", "Script vault"], guest_sessions: true },
    pricing: {
      monthly: 49,
      annual: 490,
      additional_tiers: [{ name: "Premium", price: "$99/mo" }],
    },
    trialTerms: { has_trial: true, duration_days: 7 },
    refundPolicy: "30-day money-back guarantee.",
    supportContact: "support@calmcloser.com",
    brandPrefs: "Warm neutrals, no hype.",
    creatorPhotoUrl: null,
    creatorPhotoPath: null,
    classroomIntake: null,
    calendarIntake: null,
    leaderboardLevels: null,
    categories: null,
    discoveryKeywords: null,
    createdBy: "22222222-2222-2222-2222-222222222222",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}

function makeAsset(
  module: GeneratedAsset["module"],
  content: unknown,
  overrides: Partial<GeneratedAsset> = {},
): GeneratedAsset {
  return {
    id: `asset-${module}`,
    packageId: "33333333-3333-3333-3333-333333333333",
    module,
    version: 1,
    content: content as GeneratedAsset["content"],
    approved: true,
    approvedBy: null,
    approvedAt: null,
    editHistory: [],
    vaNotes: null,
    qualityScore: null,
    createdBy: "22222222-2222-2222-2222-222222222222",
    createdAt: FIXED_DATE,
    ...overrides,
  };
}

const WEEKLY_EVENT: CalendarEvent = {
  title: "Live Q&A",
  description: "Bring your toughest objections.",
  schedule: {
    type: "weekly",
    dayOfWeek: "mon",
    interval: 1,
    time: "09:00",
    timezone: "UTC",
  },
};

/* -------------------------------------------------------------------------- */
/* serializeModuleText — one exact-string oracle per module                    */
/* -------------------------------------------------------------------------- */

describe("serializeModuleText", () => {
  test("welcome_dm returns the raw DM text", () => {
    expect(
      serializeModuleText("welcome_dm", { content: "Hey #NAME#, welcome!" }),
    ).toBe("Hey #NAME#, welcome!");
  });

  test("transformation numbers candidates and tags the first as selected", () => {
    expect(
      serializeModuleText("transformation", {
        candidates: ["Close with calm", "Sell without the sweat", "Book more calls"],
      }),
    ).toBe(
      "1. Close with calm (selected)\n2. Sell without the sweat\n3. Book more calls",
    );
  });

  test("about_us renders hero, trial, buckets, pricing, refund in order", () => {
    const text = serializeModuleText("about_us", {
      hero: "Welcome home.",
      trial_callout: "7-day free trial.",
      value_buckets: [
        { emoji: "🔥", header: "Daily coaching", items: ["Live calls every morning"] },
        { emoji: "💬", header: "Community", items: ["24/7 support chat"] },
      ],
      pricing: "$49/mo or $490/yr",
      refund_policy: "30-day money back.",
    });
    expect(text).toBe(
      "Welcome home.\n\n7-day free trial.\n\n🔥 Daily coaching\nLive calls every morning\n\n💬 Community\n24/7 support chat\n\n$49/mo or $490/yr\n\n30-day money back.",
    );
  });

  test("start_here joins the four labelled steps", () => {
    const text = serializeModuleText("start_here", {
      step_1_how_to_use: {
        title: "How to Use",
        sections: [{ name: "Navigate", description: "Use the sidebar." }],
      },
      step_2_community_rules: { title: "Rules", rules: ["Be kind", "No spam"] },
      step_3_faqs: [{ question: "Cost?", answer_template: "See pricing." }],
      step_4_need_assistance: { title: "Need help?", template: "DM @mod." },
    });
    expect(text).toBe(
      "Step 1 — How to Use\n\nNavigate\nUse the sidebar.\n\n" +
        "Step 2 — Rules\n\n1. Be kind\n2. No spam\n\n" +
        "Step 3 — FAQs\nQ: Cost?\nA: See pricing.\n\n" +
        "Step 4 — Need help?\n\nDM @mod.",
    );
  });

  test("first_post prefixes the title and separates the body", () => {
    expect(
      serializeModuleText("first_post", { title: "Welcome!", body: "Say hi below." }),
    ).toBe("Title: Welcome!\n\nSay hi below.");
  });

  test("classroom numbers each title/description block", () => {
    expect(
      serializeModuleText("classroom", {
        items: [
          { title: "Foundations", description: "Start here." },
          { title: "Advanced", description: "Go deep." },
        ],
      }),
    ).toBe("1. Foundations\nStart here.\n\n2. Advanced\nGo deep.");
  });

  test("calendar renders title / schedule / description per event", () => {
    const text = serializeModuleText("calendar", { events: [WEEKLY_EVENT] });
    // formatSchedule is independently tested; use it to build the oracle so
    // the assertion pins ordering + separators without hard-coding a
    // timezone abbreviation.
    expect(text).toBe(
      `Live Q&A\n${formatSchedule(WEEKLY_EVENT.schedule)}\nBring your toughest objections.`,
    );
  });

  test("leaderboard prefixes each level with its rank", () => {
    const levels = Array.from({ length: 9 }, (_, i) => `Level ${i + 1}`);
    expect(serializeModuleText("leaderboard", { levels })).toBe(
      "Lv 1 — Level 1\nLv 2 — Level 2\nLv 3 — Level 3\nLv 4 — Level 4\n" +
        "Lv 5 — Level 5\nLv 6 — Level 6\nLv 7 — Level 7\nLv 8 — Level 8\n" +
        "Lv 9 — Level 9",
    );
  });

  test("categories renders a numbered list", () => {
    expect(
      serializeModuleText("categories", {
        categories: ["Wins", "Questions", "Introductions"],
      }),
    ).toBe("1. Wins\n2. Questions\n3. Introductions");
  });

  test("discovery_seo joins keywords as CSV", () => {
    expect(
      serializeModuleText("discovery_seo", {
        keywords: ["sales coaching", "cold calling", "B2B"],
      }),
    ).toBe("sales coaching, cold calling, B2B");
  });
});

/* -------------------------------------------------------------------------- */
/* serializePackageMarkdown                                                    */
/* -------------------------------------------------------------------------- */

describe("serializePackageMarkdown", () => {
  const assets = [
    makeAsset("discovery_seo", { keywords: ["a", "b"] }),
    makeAsset("welcome_dm", { content: "Welcome!" }),
    makeAsset("about_us", {
      hero: "Hi",
      trial_callout: "Trial",
      value_buckets: [{ emoji: "✅", header: "H", items: ["one"] }],
      pricing: "$49",
      refund_policy: "Refunds ok",
    }),
  ];

  test("opens with the community title and intake DNA block", () => {
    const md = serializePackageMarkdown(makeCreator(), assets);
    expect(md.startsWith("# The Calm Closer — Launch Package DNA\n")).toBe(true);
    expect(md).toContain("## Community DNA (intake)");
    expect(md).toContain(
      "- **Transformation:** From call reluctance to booked-out pipeline",
    );
    expect(md).toContain("- **Audience:** B2B sales reps who dread cold calls");
    expect(md).toContain("- Monthly: $49");
    expect(md).toContain("- Additional tiers: Premium $99/mo");
    expect(md).toContain("**Trial:** 7-day trial");
  });

  test("emits one section per present module in registry order", () => {
    const md = serializePackageMarkdown(makeCreator(), assets);
    const iWelcome = md.indexOf("## Welcome DM");
    const iAbout = md.indexOf("## About Us");
    const iDiscovery = md.indexOf("## Discovery SEO");
    expect(iWelcome).toBeGreaterThan(-1);
    expect(iAbout).toBeGreaterThan(-1);
    expect(iDiscovery).toBeGreaterThan(-1);
    // Registry order is welcome_dm ... about_us ... discovery_seo, regardless
    // of the order assets were passed in.
    expect(iWelcome).toBeLessThan(iAbout);
    expect(iAbout).toBeLessThan(iDiscovery);
  });

  test("omits sections for modules with no asset", () => {
    const md = serializePackageMarkdown(makeCreator(), assets);
    expect(md).not.toContain("## Leaderboard Levels");
    expect(md).not.toContain("## Start Here");
  });

  test("renders intake DNA even when there are no generated assets", () => {
    const md = serializePackageMarkdown(makeCreator(), []);
    expect(md).toContain("## Community DNA (intake)");
    expect(md).not.toContain("## Welcome DM");
  });

  test("handles a creator with no trial and empty pricing", () => {
    const md = serializePackageMarkdown(
      makeCreator({
        trialTerms: { has_trial: false },
        pricing: { additional_tiers: [] },
        refundPolicy: null,
        brandPrefs: null,
      }),
      [],
    );
    expect(md).toContain("**Trial:** No trial");
    expect(md).toContain("**Refund policy:** —");
    // Pricing section falls back to a single em-dash line.
    expect(md).toMatch(/\*\*Pricing\*\*\n- —/);
  });
});

/* -------------------------------------------------------------------------- */
/* packageMarkdownFilename                                                     */
/* -------------------------------------------------------------------------- */

describe("packageMarkdownFilename", () => {
  test.each([
    ["The Calm Closer", "the-calm-closer-launch-package.md"],
    ["Money & Mindset!!!", "money-mindset-launch-package.md"],
    ["  Spaced  Out  ", "spaced-out-launch-package.md"],
    ["🔥 Fire Club 🔥", "fire-club-launch-package.md"],
  ])("slugs %j -> %j", (communityName, expected) => {
    expect(packageMarkdownFilename(makeCreator({ communityName }))).toBe(expected);
  });

  test("falls back to 'community' when the name has no alphanumerics", () => {
    expect(packageMarkdownFilename(makeCreator({ communityName: "🔥🔥" }))).toBe(
      "community-launch-package.md",
    );
  });
});
