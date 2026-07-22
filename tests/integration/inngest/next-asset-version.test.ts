/**
 * Unit test for `nextAssetVersion()` (src/lib/inngest/functions/_shared.ts).
 *
 * Both asset-insert paths depend on it: the shared runModule factory and the
 * bespoke generate-first-post function, which regressed by hardcoding
 * version 1. With getPackageWithDetails now ordering version DESC, a
 * hardcoded 1 let an edited row (bumped past 1 by the PATCH route) keep
 * winning over a fresh regeneration — the stuck-skeleton + stale-export bug.
 *
 * This proves the version arithmetic directly: max(version) + 1, and 1 when
 * the module has no rows yet.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

const { dbMock, versionRows } = vi.hoisted(() => {
  // Rows the max-version lookup returns. The query is
  // select({version}).from().where().orderBy(desc(version)).limit(1),
  // so at most one row — the current highest version, or none.
  const versionRows = { current: [] as { version: number }[] };
  return {
    versionRows,
    dbMock: {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => versionRows.current,
            }),
          }),
        }),
      }),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { nextAssetVersion } from "@/lib/inngest/functions/_shared";

beforeEach(() => {
  versionRows.current = [];
});

describe("nextAssetVersion", () => {
  test("no existing rows for the module → 1", async () => {
    versionRows.current = [];
    await expect(nextAssetVersion("pkg-1", "first_post")).resolves.toBe(1);
  });

  test.each([
    [1, 2],
    [3, 4],
    [7, 8],
  ])("existing max version %i → %i", async (max, expected) => {
    versionRows.current = [{ version: max }];
    await expect(nextAssetVersion("pkg-1", "first_post")).resolves.toBe(
      expected,
    );
  });
});
