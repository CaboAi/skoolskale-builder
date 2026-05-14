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
  test("accepts a minimal valid payload", () => {
    const r = CalendarContentSchema.safeParse({
      title: "Live Calls",
      description: "Weekly Q&A.",
    });
    expect(r.success).toBe(true);
  });

  test("rejects title over 30 chars", () => {
    const r = CalendarContentSchema.safeParse({
      title: "a".repeat(31),
      description: "x",
    });
    expect(r.success).toBe(false);
  });

  test("rejects description over 300 chars", () => {
    const r = CalendarContentSchema.safeParse({
      title: "ok",
      description: "a".repeat(301),
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
  const THREE = ["Intro", "Wins", "Advice"];

  test("accepts exactly 3 non-empty category names", () => {
    const r = CategoriesContentSchema.safeParse({ categories: THREE });
    expect(r.success).toBe(true);
  });

  test("rejects fewer than 3 categories", () => {
    const r = CategoriesContentSchema.safeParse({
      categories: THREE.slice(0, 2),
    });
    expect(r.success).toBe(false);
  });

  test("rejects more than 3 categories", () => {
    const r = CategoriesContentSchema.safeParse({
      categories: [...THREE, "Off topic"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects empty name", () => {
    const r = CategoriesContentSchema.safeParse({
      categories: ["", ...THREE.slice(1)],
    });
    expect(r.success).toBe(false);
  });

  test("rejects payloads where any entry carries a description field", () => {
    // The schema is strict on the tuple value type — objects fail the
    // string element validator, guaranteeing the description field is
    // dropped from the surface.
    const r = CategoriesContentSchema.safeParse({
      categories: [
        { name: "Intro", description: "say hi" },
        "Wins",
        "Advice",
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
