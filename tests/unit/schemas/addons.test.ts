import { describe, expect, test } from "vitest";
import {
  CalendarContentSchema,
  CategoriesContentSchema,
  ClassroomContentSchema,
  DiscoverySeoContentSchema,
  LeaderboardContentSchema,
} from "@/types/schemas";

/**
 * Schema validation tests for the 5 add-on modules introduced in PR #4.
 * Covers happy paths and the boundary conditions the wizard needs to surface
 * to the VA — empty fields, length caps, fixed tuple counts.
 */

describe("ClassroomContentSchema", () => {
  const oneItem = { title: "Welcome Course", description: "Start here." };

  test("accepts 1 valid item", () => {
    const r = ClassroomContentSchema.safeParse({ items: [oneItem] });
    expect(r.success).toBe(true);
  });

  test("accepts exactly 10 items", () => {
    const r = ClassroomContentSchema.safeParse({
      items: Array.from({ length: 10 }, () => oneItem),
    });
    expect(r.success).toBe(true);
  });

  test("rejects 0 items", () => {
    const r = ClassroomContentSchema.safeParse({ items: [] });
    expect(r.success).toBe(false);
  });

  test("rejects more than 10 items", () => {
    const r = ClassroomContentSchema.safeParse({
      items: Array.from({ length: 11 }, () => oneItem),
    });
    expect(r.success).toBe(false);
  });

  test("rejects empty title in any item", () => {
    const r = ClassroomContentSchema.safeParse({
      items: [{ title: "", description: "x" }],
    });
    expect(r.success).toBe(false);
  });

  test("rejects title over 50 chars in any item", () => {
    const r = ClassroomContentSchema.safeParse({
      items: [{ title: "a".repeat(51), description: "x" }],
    });
    expect(r.success).toBe(false);
  });

  test("rejects description over 500 chars in any item", () => {
    const r = ClassroomContentSchema.safeParse({
      items: [{ title: "ok", description: "a".repeat(501) }],
    });
    expect(r.success).toBe(false);
  });
});

describe("CalendarContentSchema", () => {
  const weekly = {
    title: "Office Hours",
    description: "Live Q&A and screen-share.",
    schedule: {
      type: "weekly" as const,
      dayOfWeek: "mon" as const,
      time: "09:00",
      timezone: "America/New_York",
    },
  };
  const oneOff = {
    title: "Launch Workshop",
    description: "Walkthrough.",
    schedule: {
      type: "one_off" as const,
      date: "2026-08-08",
      time: "11:00",
      timezone: "America/Los_Angeles",
    },
  };

  test("accepts an events array with a single weekly event", () => {
    const r = CalendarContentSchema.safeParse({ events: [weekly] });
    expect(r.success).toBe(true);
  });

  test("accepts an events array mixing weekly and one_off", () => {
    const r = CalendarContentSchema.safeParse({ events: [weekly, oneOff] });
    expect(r.success).toBe(true);
  });

  test("rejects 0 events", () => {
    const r = CalendarContentSchema.safeParse({ events: [] });
    expect(r.success).toBe(false);
  });

  test("rejects more than 10 events", () => {
    const r = CalendarContentSchema.safeParse({
      events: Array.from({ length: 11 }, () => weekly),
    });
    expect(r.success).toBe(false);
  });

  test("rejects event description over 300 chars", () => {
    const r = CalendarContentSchema.safeParse({
      events: [{ ...weekly, description: "a".repeat(301) }],
    });
    expect(r.success).toBe(false);
  });

  test("rejects HH:mm with invalid hour", () => {
    const r = CalendarContentSchema.safeParse({
      events: [
        { ...weekly, schedule: { ...weekly.schedule, time: "25:00" } },
      ],
    });
    expect(r.success).toBe(false);
  });

  test("rejects one_off date that isn't YYYY-MM-DD", () => {
    const r = CalendarContentSchema.safeParse({
      events: [
        { ...oneOff, schedule: { ...oneOff.schedule, date: "8/8/2026" } },
      ],
    });
    expect(r.success).toBe(false);
  });

  test("rejects mixing weekly fields onto a one_off discriminant", () => {
    const r = CalendarContentSchema.safeParse({
      events: [
        {
          ...weekly,
          schedule: {
            type: "one_off",
            // missing date, has dayOfWeek which is invalid for one_off
            dayOfWeek: "mon",
            time: "09:00",
            timezone: "UTC",
          },
        },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("LeaderboardContentSchema", () => {
  const NINE = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

  test("accepts exactly 9 non-empty levels", () => {
    const r = LeaderboardContentSchema.safeParse({ levels: NINE });
    expect(r.success).toBe(true);
  });

  test("rejects fewer than 9 levels", () => {
    const r = LeaderboardContentSchema.safeParse({
      levels: NINE.slice(0, 8),
    });
    expect(r.success).toBe(false);
  });

  test("rejects more than 9 levels", () => {
    const r = LeaderboardContentSchema.safeParse({
      levels: [...NINE, "j"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects an empty string at any position", () => {
    const withBlank = [...NINE];
    withBlank[4] = "";
    const r = LeaderboardContentSchema.safeParse({ levels: withBlank });
    expect(r.success).toBe(false);
  });
});

describe("CategoriesContentSchema", () => {
  const THREE = [
    { name: "Intro", description: "say hi" },
    { name: "Wins", description: "share progress" },
    { name: "Advice", description: "tips" },
  ];

  test("accepts exactly 3 categories with name + description", () => {
    const r = CategoriesContentSchema.safeParse({ categories: THREE });
    expect(r.success).toBe(true);
  });

  test("rejects fewer than 3 categories", () => {
    const r = CategoriesContentSchema.safeParse({
      categories: THREE.slice(0, 2),
    });
    expect(r.success).toBe(false);
  });

  test("rejects empty name", () => {
    const r = CategoriesContentSchema.safeParse({
      categories: [
        { name: "", description: "x" },
        ...THREE.slice(1),
      ],
    });
    expect(r.success).toBe(false);
  });

  test("rejects empty description", () => {
    const r = CategoriesContentSchema.safeParse({
      categories: [
        { name: "Intro", description: "" },
        ...THREE.slice(1),
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("DiscoverySeoContentSchema", () => {
  test("accepts 1 keyword", () => {
    const r = DiscoverySeoContentSchema.safeParse({ keywords: ["yoga"] });
    expect(r.success).toBe(true);
  });

  test("accepts exactly 11 keywords", () => {
    const r = DiscoverySeoContentSchema.safeParse({
      keywords: Array.from({ length: 11 }, (_, i) => `kw${i}`),
    });
    expect(r.success).toBe(true);
  });

  test("rejects 0 keywords", () => {
    const r = DiscoverySeoContentSchema.safeParse({ keywords: [] });
    expect(r.success).toBe(false);
  });

  test("rejects 12 keywords", () => {
    const r = DiscoverySeoContentSchema.safeParse({
      keywords: Array.from({ length: 12 }, (_, i) => `kw${i}`),
    });
    expect(r.success).toBe(false);
  });

  test("rejects empty-string keyword", () => {
    const r = DiscoverySeoContentSchema.safeParse({
      keywords: ["yoga", "", "mindfulness"],
    });
    expect(r.success).toBe(false);
  });
});
