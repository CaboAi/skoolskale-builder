/**
 * Cross-module dependency resolver — first_post reads the intro-category
 * name from the generated categories asset. This is the first such
 * dependency in the builder; the resolver gates how robust the v1
 * polling-with-backoff approach is.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { FALLBACK_INTRO_CATEGORY } from "@/prompts/first-post";

const { dbSelectLimit } = vi.hoisted(() => ({
  dbSelectLimit: vi.fn<() => Promise<Array<{ content: unknown }>>>(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: dbSelectLimit,
        }),
      }),
    }),
  },
}));

import { resolveIntroCategory } from "@/lib/inngest/resolve-intro-category";

const zeroSleep = () => Promise.resolve();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveIntroCategory", () => {
  test("returns the /intro/i-matching name when categories asset is present", async () => {
    dbSelectLimit.mockResolvedValue([
      { content: { categories: ["Introductions", "Wins", "Ask Ramsha"] } },
    ]);
    const name = await resolveIntroCategory("pkg-1", { sleep: zeroSleep });
    expect(name).toBe("Introductions");
  });

  test("matches case-insensitively on 'intro' anywhere in the name", async () => {
    dbSelectLimit.mockResolvedValue([
      {
        content: {
          categories: ["Wins", "Plant your flag (intro)", "Advice"],
        },
      },
    ]);
    const name = await resolveIntroCategory("pkg-1", { sleep: zeroSleep });
    expect(name).toBe("Plant your flag (intro)");
  });

  test("returns the FALLBACK when categories present but no name contains 'intro'", async () => {
    dbSelectLimit.mockResolvedValue([
      {
        content: {
          categories: ["Plant your flag", "Brag board", "Pick the brain"],
        },
      },
    ]);
    const name = await resolveIntroCategory("pkg-1", { sleep: zeroSleep });
    expect(name).toBe(FALLBACK_INTRO_CATEGORY);
  });

  test("polls then returns FALLBACK when categories asset never appears", async () => {
    dbSelectLimit.mockResolvedValue([]);
    const name = await resolveIntroCategory("pkg-1", {
      sleep: zeroSleep,
      // Tighten the delay list so the test isn't dominated by setTimeout
      // bookkeeping; we only want to verify the retry count.
      delays: [0, 0, 0],
    });
    expect(name).toBe(FALLBACK_INTRO_CATEGORY);
    expect(dbSelectLimit).toHaveBeenCalledTimes(3);
  });

  test("succeeds mid-polling when categories asset appears on a later attempt", async () => {
    dbSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { content: { categories: ["Introduce Yourself", "Wins", "Advice"] } },
      ]);
    const name = await resolveIntroCategory("pkg-1", {
      sleep: zeroSleep,
      delays: [0, 0, 0, 0, 0],
    });
    expect(name).toBe("Introduce Yourself");
    expect(dbSelectLimit).toHaveBeenCalledTimes(3);
  });

  test("returns FALLBACK when categories content shape is corrupted", async () => {
    dbSelectLimit.mockResolvedValue([
      { content: { not_categories: "broken" } },
    ]);
    const name = await resolveIntroCategory("pkg-1", {
      sleep: zeroSleep,
      delays: [0],
    });
    expect(name).toBe(FALLBACK_INTRO_CATEGORY);
  });

  test("returns FALLBACK when content is null", async () => {
    dbSelectLimit.mockResolvedValue([{ content: null }]);
    const name = await resolveIntroCategory("pkg-1", {
      sleep: zeroSleep,
      delays: [0],
    });
    expect(name).toBe(FALLBACK_INTRO_CATEGORY);
  });
});
