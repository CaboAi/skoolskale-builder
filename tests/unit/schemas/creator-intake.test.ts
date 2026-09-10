import { describe, expect, test } from "vitest";
import { CreatorIntakeSchema } from "@/types/schemas";

/**
 * Schema validation tests for the post-cleanup `CreatorIntake` shape:
 *  - `offer_breakdown` no longer carries `courses` or `events`
 *  - `pricing.additional_tiers` replaces `pricing.tiers` and is name-locked
 *    to a 2-slot `Premium`-then-`VIP` ordering, max 2 rows total.
 *
 * These tests cover the boundary conditions the wizard surfaces to the VA
 * (and the API route's PATCH validator picks up).
 */

const VALID_INTAKE = {
  name: "Jane",
  community_name: "Sanctuary",
  niche: "spiritual" as const,
  audience: "soul-led women",
  transformation: "reclaim your power",
  tone: "warm" as const,
  offer_breakdown: { perks: [], guest_sessions: false },
  pricing: { monthly: 47, annual: 470, additional_tiers: [] },
  trial_terms: { has_trial: false, duration_days: 7 as const },
  refund_policy: "14 days",
  support_contact: "support@example.test",
  brand_prefs: "",
  classroom_titles: ["Foundations"],
  calendar_intake: {
    events: [
      {
        title: "Weekly Q&A",
        schedule: {
          type: "weekly" as const,
          dayOfWeek: "mon" as const,
          time: "09:00",
          timezone: "America/New_York",
        },
      },
    ],
  },
};

describe("CreatorIntakeSchema — offer_breakdown cleanup", () => {
  test("accepts the minimal offer_breakdown shape (perks + guest_sessions only)", () => {
    const r = CreatorIntakeSchema.safeParse(VALID_INTAKE);
    expect(r.success).toBe(true);
  });

  test("accepts payloads that omit the deprecated `courses` and `events` keys", () => {
    const r = CreatorIntakeSchema.safeParse({
      ...VALID_INTAKE,
      offer_breakdown: { perks: ["private podcast"], guest_sessions: true },
    });
    expect(r.success).toBe(true);
  });

  test("silently ignores legacy `courses` and `events` keys for back-compat", () => {
    // Zod's default object behavior strips unknown keys, so legacy DB rows
    // hydrating with `courses` / `events` in the jsonb payload still pass
    // validation — the keys just disappear after parse. This pins the
    // expectation so we notice if anyone tightens to `.strict()`.
    const r = CreatorIntakeSchema.safeParse({
      ...VALID_INTAKE,
      offer_breakdown: {
        perks: [],
        guest_sessions: false,
        courses: [{ name: "Legacy" }],
        events: ["Legacy event"],
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect("courses" in r.data.offer_breakdown).toBe(false);
      expect("events" in r.data.offer_breakdown).toBe(false);
    }
  });
});

describe("CreatorIntakeSchema — pricing.additional_tiers", () => {
  function withTiers(
    tiers: { name: string; price: string }[],
  ): unknown {
    return {
      ...VALID_INTAKE,
      pricing: { ...VALID_INTAKE.pricing, additional_tiers: tiers },
    };
  }

  test("accepts an empty additional_tiers array", () => {
    const r = CreatorIntakeSchema.safeParse(withTiers([]));
    expect(r.success).toBe(true);
  });

  test("accepts a single Premium tier", () => {
    const r = CreatorIntakeSchema.safeParse(
      withTiers([{ name: "Premium", price: "$99" }]),
    );
    expect(r.success).toBe(true);
  });

  test("accepts Premium followed by VIP", () => {
    const r = CreatorIntakeSchema.safeParse(
      withTiers([
        { name: "Premium", price: "$99" },
        { name: "VIP", price: "$299" },
      ]),
    );
    expect(r.success).toBe(true);
  });

  test("rejects a freeform tier name", () => {
    const r = CreatorIntakeSchema.safeParse(
      withTiers([{ name: "Gold", price: "$99" }]),
    );
    expect(r.success).toBe(false);
  });

  test("rejects more than 2 additional tiers", () => {
    const r = CreatorIntakeSchema.safeParse(
      withTiers([
        { name: "Premium", price: "$99" },
        { name: "VIP", price: "$199" },
        { name: "VIP", price: "$299" },
      ]),
    );
    expect(r.success).toBe(false);
  });

  test("rejects a lone VIP (Premium must come first)", () => {
    const r = CreatorIntakeSchema.safeParse(
      withTiers([{ name: "VIP", price: "$199" }]),
    );
    expect(r.success).toBe(false);
  });

  test("rejects VIP-before-Premium ordering", () => {
    const r = CreatorIntakeSchema.safeParse(
      withTiers([
        { name: "VIP", price: "$299" },
        { name: "Premium", price: "$99" },
      ]),
    );
    expect(r.success).toBe(false);
  });

  test("rejects two Premium tiers (no duplicates of the same name)", () => {
    const r = CreatorIntakeSchema.safeParse(
      withTiers([
        { name: "Premium", price: "$99" },
        { name: "Premium", price: "$199" },
      ]),
    );
    expect(r.success).toBe(false);
  });
});
