/**
 * Cost-estimator coverage for the opus-4-8 handover pricing extension:
 * cache read/write token classes and the fallback ratios for models with
 * no explicit cache rates. Mirrors tests/unit/claude/usage.test.ts —
 * `@/lib/claude/usage` transitively imports `@/lib/db`, so the DB module
 * is stubbed and the estimator dynamically imported.
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { update: () => ({ set: () => ({ where: async () => {} }) }) },
}));

describe("estimateCostUsd — opus 4-8 + cache token classes", () => {
  test("opus-4-8 with all four classes at 1M each → 5 + 25 + 0.5 + 6.25 = 36.75", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    expect(
      estimateCostUsd(
        "claude-opus-4-8",
        1_000_000,
        1_000_000,
        1_000_000,
        1_000_000,
      ),
    ).toBe(36.75);
  });

  test("3-arg back-compat call is unchanged for sonnet-4-6 ($3 + $15 = $18)", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    expect(estimateCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBe(18);
  });

  test("unknown model falls back to sonnet rates, including cache fallback ratios", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    const unknown = estimateCostUsd(
      "claude-made-up-model",
      1_000_000,
      1_000_000,
      1_000_000,
      1_000_000,
    );
    const sonnet = estimateCostUsd(
      "claude-sonnet-4-6",
      1_000_000,
      1_000_000,
      1_000_000,
      1_000_000,
    );
    // 3 + 15 + (3 * 0.1) + (3 * 1.25) = 22.05
    expect(unknown).toBe(22.05);
    expect(unknown).toBe(sonnet);
  });

  test("cache-read fallback for a model without cache rates = 10% of input rate", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    // sonnet-4-6 has no cacheReadPerM → 1M reads at $3 * 0.1 = $0.30
    expect(estimateCostUsd("claude-sonnet-4-6", 0, 0, 1_000_000, 0)).toBe(0.3);
  });

  test("cache-write fallback for a model without cache rates = 1.25x input rate", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    // sonnet-4-6 has no cacheWritePerM → 1M writes at $3 * 1.25 = $3.75
    expect(estimateCostUsd("claude-sonnet-4-6", 0, 0, 0, 1_000_000)).toBe(3.75);
  });

  test("explicit opus-4-8 cache rates beat the fallback ratios", async () => {
    const { estimateCostUsd } = await import("@/lib/claude/usage");
    // cacheRead: $0.50/M (not 5 * 0.1 = 0.5 — same value but pinned) and
    // cacheWrite: $6.25/M (5-min ephemeral TTL rate, matches 5 * 1.25).
    expect(estimateCostUsd("claude-opus-4-8", 0, 0, 1_000_000, 0)).toBe(0.5);
    expect(estimateCostUsd("claude-opus-4-8", 0, 0, 0, 1_000_000)).toBe(6.25);
  });
});
