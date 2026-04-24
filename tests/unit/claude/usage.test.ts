/**
 * Cost estimator is pure and fast to unit-test. The write path (logClaudeUsage)
 * uses the DB and is covered in the generator integration tests (ticket 3.6).
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { update: () => ({ set: () => ({ where: async () => {} }) }) },
}));

describe("estimateCostUsd", () => {
  test("computes sonnet-4-6 cost from token counts", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    // 1M input + 1M output at $3/$15 → $18.00
    expect(estimateCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBe(18);
  });

  test("returns 0 on zero usage", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    expect(estimateCostUsd("claude-sonnet-4-6", 0, 0)).toBe(0);
  });

  test("falls back to sonnet rates on unknown model id", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    const sonnet = estimateCostUsd("claude-sonnet-4-6", 5000, 2000);
    const unknown = estimateCostUsd("claude-made-up-model", 5000, 2000);
    expect(unknown).toBe(sonnet);
  });

  test("opus rate is higher than sonnet for the same token mix", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    expect(estimateCostUsd("claude-opus-4-5", 10_000, 5_000)).toBeGreaterThan(
      estimateCostUsd("claude-sonnet-4-6", 10_000, 5_000),
    );
  });
});
