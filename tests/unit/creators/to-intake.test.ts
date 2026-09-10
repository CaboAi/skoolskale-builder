import { describe, expect, test } from "vitest";
import { creatorToIntake } from "@/lib/creators/to-intake";
import { CreatorIntakeSchema } from "@/types/schemas";
import { makeCreator } from "../../prompts/handover/fixtures";

/** A row with every add-on field populated and valid. */
function completeCreator() {
  return makeCreator({
    classroomIntake: ["Foundations", "Deep Work"],
    calendarIntake: {
      events: [
        {
          title: "Weekly Q&A",
          schedule: {
            type: "weekly",
            dayOfWeek: "mon",
            interval: 1,
            time: "09:00",
            timezone: "America/New_York",
          },
        },
      ],
    },
    leaderboardLevels: [
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ],
    categories: ["Wins", "Questions", "Intros"],
    discoveryKeywords: ["breathwork", "calm"],
  });
}

describe("creatorToIntake", () => {
  test("maps camelCase columns onto the snake_case intake shape", () => {
    const intake = creatorToIntake(completeCreator());
    expect(intake.name).toBe("Jane Doe");
    expect(intake.community_name).toBe("Soul Collective");
    expect(intake.niche).toBe("spiritual");
    expect(intake.tone).toBe("warm");
    expect(intake.audience).toBe("women 30-55");
    expect(intake.transformation).toBe("reclaim your power");
    expect(intake.support_contact).toBe("support@example.test");
    expect(intake.refund_policy).toBe("14-day refund");
    expect(intake.brand_prefs).toBe("purple palette");
  });

  test("a fully populated row round-trips through the submit schema", () => {
    // The shared fixture stores a lone VIP tier, which the schema's
    // "Premium first" ordering rule rejects on its own terms. Swap in an
    // ordered tier list so this asserts the mapper's output shape rather
    // than re-testing that refinement.
    const creator = makeCreator({
      ...completeCreator(),
      pricing: {
        monthly: 27,
        annual: 227,
        additional_tiers: [{ name: "Premium", price: "$57/mo or $477/yr" }],
      },
    });
    const result = CreatorIntakeSchema.safeParse(creatorToIntake(creator));
    expect(result.success).toBe(true);
  });

  test("offer and pricing blobs carry through", () => {
    const intake = creatorToIntake(completeCreator());
    expect(intake.offer_breakdown).toEqual({
      perks: ["Monthly Q&A", "Templates"],
      guest_sessions: true,
    });
    expect(intake.pricing.monthly).toBe(27);
    expect(intake.pricing.annual).toBe(227);
    expect(intake.pricing.additional_tiers).toEqual([
      { name: "VIP", price: "$57/mo or $477/yr" },
    ]);
  });

  test("free_community is false when the row predates the flag", () => {
    const intake = creatorToIntake(completeCreator());
    expect(intake.pricing.free_community).toBe(false);
  });

  test("free_community is true only when the stored blob says so", () => {
    const creator = completeCreator();
    const intake = creatorToIntake(
      makeCreator({
        ...creator,
        pricing: { monthly: 27, annual: 227, free_community: true },
      }),
    );
    expect(intake.pricing.free_community).toBe(true);
  });

  test("null text columns hydrate to empty strings, not null", () => {
    const intake = creatorToIntake(
      makeCreator({
        refundPolicy: null,
        supportContact: null,
        brandPrefs: null,
      }),
    );
    expect(intake.refund_policy).toBe("");
    expect(intake.support_contact).toBe("");
    expect(intake.brand_prefs).toBe("");
  });

  test("a missing classroom list seeds one blank row so the repeater renders", () => {
    const intake = creatorToIntake(makeCreator({ classroomIntake: null }));
    expect(intake.classroom_titles).toEqual([""]);
  });

  test("add-on blobs that do not fit their schema fall back to undefined", () => {
    const intake = creatorToIntake(
      makeCreator({
        // A four-level list cannot satisfy the nine-level tuple, and a
        // two-item list cannot satisfy the three-category tuple.
        leaderboardLevels: ["One", "Two", "Three", "Four"],
        categories: ["Wins", "Questions"],
        calendarIntake: { events: "not an array" },
      }),
    );
    expect(intake.leaderboard_levels).toBeUndefined();
    expect(intake.categories).toBeUndefined();
    expect(intake.calendar_intake).toBeUndefined();
  });

  test("valid add-on blobs are preserved exactly", () => {
    const intake = creatorToIntake(completeCreator());
    expect(intake.classroom_titles).toEqual(["Foundations", "Deep Work"]);
    expect(intake.categories).toEqual(["Wins", "Questions", "Intros"]);
    expect(intake.discovery_keywords).toEqual(["breathwork", "calm"]);
    expect(intake.calendar_intake?.events).toHaveLength(1);
    expect(intake.calendar_intake?.events[0].title).toBe("Weekly Q&A");
  });

  test("trial duration is pinned at 7 regardless of what the row stores", () => {
    const intake = creatorToIntake(
      makeCreator({ trialTerms: { has_trial: true, duration_days: 30 } }),
    );
    expect(intake.trial_terms).toEqual({ has_trial: true, duration_days: 7 });
  });
});
