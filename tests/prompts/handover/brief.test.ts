import { describe, expect, test } from "vitest";
import {
  buildHandoverBrief,
  formatBrief,
  guessEntryTierName,
  parseTierPrice,
} from "@/prompts/handover/brief";
import {
  FULL_BRIEF,
  MINIMAL_BRIEF,
  makeAsset,
  makeAssets,
  makeCreator,
} from "./fixtures";

describe("parseTierPrice", () => {
  test.each([
    ["$57/mo or $477/yr", { monthly: "$57/mo", annual: "$477/yr" }],
    ["57m or 477", { monthly: "$57/mo", annual: "$477/yr" }],
    ["477/yr or 57", { monthly: "$57/mo", annual: "$477/yr" }],
    ["$477/yr", { monthly: null, annual: "$477/yr" }],
    ["$57/mo", { monthly: "$57/mo", annual: null }],
    ["57", { monthly: "$57/mo", annual: null }],
    ["27 or 227", { monthly: "$27/mo", annual: "$227/yr" }],
    ["", { monthly: null, annual: null }],
  ])("%j → %j", (input, expected) => {
    expect(parseTierPrice(input)).toEqual(expected);
  });
});

describe("guessEntryTierName", () => {
  test.each([
    ["Standard: $27/mo or $227/yr", "Standard"],
    ["VIP: $57/mo", "VIP"],
    ["our Membership includes everything", "Membership"],
    ["premium access to the library", "Premium"],
    ["join the movement today", "Standard"],
    ["", "Standard"],
  ])("%j → %j", (input, expected) => {
    expect(guessEntryTierName(input)).toBe(expected);
  });
});

describe("buildHandoverBrief", () => {
  test("identity fields come straight from the creator row", () => {
    const brief = buildHandoverBrief(makeCreator(), makeAssets());
    expect(brief.creator).toBe("Jane Doe");
    expect(brief.creatorFirst).toBe("Jane");
    expect(brief.community).toBe("Soul Collective");
    expect(brief.slug).toBe("soul-collective");
    expect(brief.niche).toBe("spiritual");
    expect(brief.tone).toBe("warm");
    expect(brief.transformation).toBe("reclaim your power");
    expect(brief.audience).toBe("women 30-55");
  });

  test("entry tier named from about-us pricing text; additional tiers parsed; annual detected", () => {
    const brief = buildHandoverBrief(makeCreator(), makeAssets());
    expect(brief.pricing).toEqual({
      tiers: [
        { name: "Standard", monthly: "$27/mo", annual: "$227/yr" },
        { name: "VIP", monthly: "$57/mo", annual: "$477/yr" },
      ],
      hasAnnual: true,
      freeTier: true,
    });
  });

  test("offer, trial, refund, support, and brand fields map through", () => {
    const brief = buildHandoverBrief(makeCreator(), makeAssets());
    expect(brief.guestSessions).toBe(true);
    expect(brief.perks).toBe("Monthly Q&A; Templates");
    expect(brief.trial).toBe("No trial");
    expect(brief.refund).toBe("14-day refund");
    expect(brief.supportEmail).toBe("support@example.test");
    expect(brief.brandPrefs).toBe("purple palette");
  });

  test("asset-derived fields: transformation line, modules, levels, categories", () => {
    const brief = buildHandoverBrief(makeCreator(), makeAssets());
    expect(brief.transformationLine).toBe("From burned out to grounded");
    expect(brief.modules).toEqual(["Foundations", "Deep Work"]);
    expect(brief.levels).toEqual(["Seeker", "Guide", "Sage"]);
    expect(brief.categories).toEqual(["Wins", "Questions"]);
  });

  test("calendar events become calls with formatted schedules and optional blurbs", () => {
    const brief = buildHandoverBrief(makeCreator(), makeAssets());
    expect(brief.calls).toHaveLength(2);
    expect(brief.calls[0].name).toBe("Weekly Q&A");
    expect(brief.calls[0].when).toContain("Monday");
    expect(brief.calls[0].when).toContain("9:00 AM");
    expect(brief.calls[0].blurb).toBe("Live questions");
    expect(brief.calls[1].name).toBe("Breathwork");
    expect(brief.calls[1].when).toContain("Wednesday");
    expect(brief.calls[1].blurb).toBeNull();
  });

  test.each([
    [{ has_trial: true, duration_days: 14 }, "14-day trial"],
    [{ has_trial: true }, "7-day trial"],
    [{ has_trial: false, duration_days: 14 }, "No trial"],
    [null, "No trial"],
  ])("trialTerms %j → %j", (trialTerms, expected) => {
    const brief = buildHandoverBrief(makeCreator({ trialTerms }), []);
    expect(brief.trial).toBe(expected);
  });

  test("missing assets: empty lists, null transformation line, Standard fallback tier name", () => {
    const brief = buildHandoverBrief(makeCreator(), []);
    expect(brief.modules).toEqual([]);
    expect(brief.calls).toEqual([]);
    expect(brief.levels).toEqual([]);
    expect(brief.categories).toEqual([]);
    expect(brief.transformationLine).toBeNull();
    expect(brief.pricing.tiers[0]).toEqual({
      name: "Standard",
      monthly: "$27/mo",
      annual: "$227/yr",
    });
  });

  test("empty-string support/refund/brand fields normalize to null", () => {
    const brief = buildHandoverBrief(
      makeCreator({ supportContact: "", refundPolicy: "", brandPrefs: "" }),
      [],
    );
    expect(brief.supportEmail).toBeNull();
    expect(brief.refund).toBeNull();
    expect(brief.brandPrefs).toBeNull();
  });

  test("empty perks list and guest_sessions false", () => {
    const brief = buildHandoverBrief(
      makeCreator({ offerBreakdown: { perks: [], guest_sessions: false } }),
      [],
    );
    expect(brief.perks).toBeNull();
    expect(brief.guestSessions).toBe(false);
  });

  test("no entry pricing: only additional tiers survive; acronym casing applied", () => {
    const brief = buildHandoverBrief(
      makeCreator({
        pricing: { additional_tiers: [{ name: "vip pro", price: "97" }] },
      }),
      [],
    );
    expect(brief.pricing.tiers).toEqual([
      { name: "VIP PRO", monthly: "$97/mo", annual: null },
    ]);
    expect(brief.pricing.hasAnnual).toBe(false);
  });

  test.each([
    ["The 5AM Club!", "the-5am-club"],
    ["!!!", "community"],
  ])("slug for community name %j is %j", (communityName, expected) => {
    const brief = buildHandoverBrief(makeCreator({ communityName }), []);
    expect(brief.slug).toBe(expected);
  });
});

describe("formatBrief", () => {
  test("full brief renders the complete facts block (annual urgency ON)", () => {
    expect(formatBrief(FULL_BRIEF)).toBe(
      `COMMUNITY DNA BRIEF — use ONLY these facts; never invent others.
- Community: Soul Collective
- Creator: Jane Doe (sign as "Jane")
- Niche: spiritual · Tone: warm (match the DNA's own writing rhythm)
- Transformation: reclaim your power
- Selected transformation line: From burned out to grounded
- Audience: women 30-55
- Support contact: support@example.test
- Guest sessions: YES
- Trial: No trial · Refund: 14-day refund
- Pricing tiers (use these names + prices consistently everywhere): Free · Standard ($27/mo or $227/yr) · VIP ($57/mo or $477/yr)
- Annual pricing exists: YES — founding-member urgency ON, lead annual
- Classroom modules: Foundations · Deep Work
- Live calls (Calendar): "Weekly Q&A" (Every Monday at 9:00 AM PST) · "Breathwork"
- Leaderboard levels: Seeker → Guide → Sage
- Post categories: Wins · Questions`,
    );
  });

  test("minimal brief renders the not-specified / no / none-listed branches", () => {
    expect(formatBrief(MINIMAL_BRIEF)).toBe(
      `COMMUNITY DNA BRIEF — use ONLY these facts; never invent others.
- Community: Iron Circle
- Creator: Bo Smith (sign as "Bo")
- Niche: fitness · Tone: bold (match the DNA's own writing rhythm)
- Transformation: get strong without burning out
- Selected transformation line: not specified
- Audience: men 25-45
- Support contact: not specified
- Guest sessions: NO
- Trial: 7-day trial · Refund: not specified
- Pricing tiers (use these names + prices consistently everywhere): Free · Standard ($27/mo)
- Annual pricing exists: no
- Classroom modules: none listed
- Live calls (Calendar): none listed
- Leaderboard levels: none listed
- Post categories: none listed`,
    );
  });
});

describe("buildHandoverBrief → formatBrief integration", () => {
  test("a built brief renders without leaking undefined/null into the text", () => {
    const brief = buildHandoverBrief(makeCreator(), [
      makeAsset("about_us", { pricing: "Standard: $27/mo or $227/yr" }),
    ]);
    const text = formatBrief(brief);
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(text).toContain("Standard ($27/mo or $227/yr)");
  });
});
