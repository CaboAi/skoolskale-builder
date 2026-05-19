import { describe, expect, test } from "vitest";
import {
  CreatorDraftSchema,
  CreatorSubmitSchema,
  CreatorStep1Schema,
} from "@/types/schemas";

/**
 * Schema split coverage for the draft-autosave fix.
 *
 * Before the fix: a single CreatorPatchSchema (= CreatorIntakeSchema.partial()
 * + top-level empty-string strip) handled both autosave and submit, and
 * tripped on the wizard's Step 5 seed values (classroom_titles: [""],
 * calendar_intake.events[0].title: "") which survive the top-level strip
 * because the empty string lives INSIDE an array. The fix splits the schema:
 *
 *   CreatorDraftSchema  — autosave. Permissive structurally; no .min(1)
 *                         constraints; nested arrays / objects optional.
 *   CreatorSubmitSchema — final submit. The strict shape (alias for
 *                         CreatorIntakeSchema). Unchanged behavior.
 *   CreatorStep1Schema  — Step 1 POST (renamed from the old
 *                         CreatorDraftSchema, which was misnamed).
 */

const VALID_COMPLETE = {
  name: "Jane Doe",
  community_name: "Alchemy",
  niche: "spiritual" as const,
  audience: "Soul-led women 30-55",
  transformation: "Reclaim your power",
  tone: "warm" as const,
  offer_breakdown: { perks: ["private podcast"], guest_sessions: false },
  pricing: { monthly: 47, annual: 470, additional_tiers: [] },
  trial_terms: { has_trial: true, duration_days: 7 as const },
  refund_policy: "14 days, no questions",
  support_contact: "support@alchemy.co",
  brand_prefs: "soft gold + deep teal",
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

describe("CreatorDraftSchema (autosave, permissive)", () => {
  test("accepts the seed-shaped payload the wizard autosaves on Steps 1-4", () => {
    // This is the regression — without the fix, the inner empty strings
    // inside `classroom_titles` and `calendar_intake.events[0].title`
    // trip the strict schema's .min(1) constraints.
    const payload = {
      name: "Jane",
      community_name: "Sanctuary",
      niche: "spiritual" as const,
      support_contact: "jane@example.com",
      classroom_titles: [""],
      calendar_intake: {
        events: [
          {
            title: "",
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
    const result = CreatorDraftSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  test("accepts a single-field partial payload", () => {
    expect(
      CreatorDraftSchema.safeParse({ community_name: "test" }).success,
    ).toBe(true);
  });

  test("accepts deeply nested partial state — pricing with only monthly set", () => {
    expect(
      CreatorDraftSchema.safeParse({
        pricing: { monthly: 47 },
      }).success,
    ).toBe(true);
  });

  test("rejects an empty payload (refine requires at least one field)", () => {
    expect(CreatorDraftSchema.safeParse({}).success).toBe(false);
  });

  test("rejects a payload that is all empty strings (preprocess strips, refine fires)", () => {
    expect(
      CreatorDraftSchema.safeParse({
        name: "",
        community_name: "",
        audience: "",
      }).success,
    ).toBe(false);
  });

  test("rejects a type mismatch — string where pricing.monthly expects a number", () => {
    const result = CreatorDraftSchema.safeParse({
      pricing: { monthly: "twenty" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects a type mismatch on a nested array element — number where event title expects a string", () => {
    const result = CreatorDraftSchema.safeParse({
      calendar_intake: {
        events: [{ title: 42 }],
      },
    });
    expect(result.success).toBe(false);
  });

  test("accepts a full complete payload (the strict submit shape is a valid draft too)", () => {
    expect(CreatorDraftSchema.safeParse(VALID_COMPLETE).success).toBe(true);
  });

  test("accepts unknown nested keys on offer_breakdown (passthrough)", () => {
    // Legacy DB rows can hydrate with extra keys (e.g. `courses`,
    // `events`). The autosave must tolerate them so reloading a draft
    // doesn't error.
    expect(
      CreatorDraftSchema.safeParse({
        offer_breakdown: {
          perks: [],
          guest_sessions: false,
          courses: [{ name: "Legacy" }],
        },
      }).success,
    ).toBe(true);
  });

  test("does NOT enforce additional_tiers ordering (that's a submit-time check)", () => {
    // Strict schema rejects [VIP, Premium] ordering; the autosave must
    // accept it because the VA might be mid-edit when the timer fires.
    expect(
      CreatorDraftSchema.safeParse({
        pricing: {
          additional_tiers: [
            { name: "VIP", price: "$299" },
            { name: "Premium", price: "$99" },
          ],
        },
      }).success,
    ).toBe(true);
  });
});

describe("CreatorSubmitSchema (final submit, strict)", () => {
  test("accepts a complete payload", () => {
    expect(CreatorSubmitSchema.safeParse(VALID_COMPLETE).success).toBe(true);
  });

  test("rejects an empty payload", () => {
    expect(CreatorSubmitSchema.safeParse({}).success).toBe(false);
  });

  test("rejects the seed-shaped draft payload (empty classroom title inside array)", () => {
    // Same payload the autosave accepts must fail at submit time — the
    // .min(1) on the inner string still bites here.
    expect(
      CreatorSubmitSchema.safeParse({
        name: "Jane",
        community_name: "Sanctuary",
        niche: "spiritual",
        audience: "x",
        transformation: "x",
        tone: "warm",
        offer_breakdown: { perks: [], guest_sessions: false },
        pricing: { additional_tiers: [] },
        trial_terms: { has_trial: false, duration_days: 7 },
        refund_policy: "",
        support_contact: "jane@example.com",
        brand_prefs: "",
        classroom_titles: [""],
      }).success,
    ).toBe(false);
  });

  test("still rejects additional_tiers ordering violations", () => {
    expect(
      CreatorSubmitSchema.safeParse({
        ...VALID_COMPLETE,
        pricing: {
          ...VALID_COMPLETE.pricing,
          additional_tiers: [
            { name: "VIP", price: "$299" },
            { name: "Premium", price: "$99" },
          ],
        },
      }).success,
    ).toBe(false);
  });
});

describe("CreatorStep1Schema (Step 1 POST bootstrap)", () => {
  test("accepts the Step 1 fields", () => {
    expect(
      CreatorStep1Schema.safeParse({
        name: "Jane",
        community_name: "Sanctuary",
        niche: "spiritual",
        support_contact: "jane@example.com",
      }).success,
    ).toBe(true);
  });

  test("rejects empty name", () => {
    expect(
      CreatorStep1Schema.safeParse({
        name: "",
        community_name: "Sanctuary",
        niche: "spiritual",
        support_contact: "jane@example.com",
      }).success,
    ).toBe(false);
  });

  test("rejects an invalid creator_photo_url", () => {
    expect(
      CreatorStep1Schema.safeParse({
        name: "Jane",
        community_name: "Sanctuary",
        niche: "spiritual",
        support_contact: "jane@example.com",
        creator_photo_url: "not-a-url",
      }).success,
    ).toBe(false);
  });
});
