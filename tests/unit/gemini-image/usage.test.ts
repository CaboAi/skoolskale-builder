/**
 * Cost estimator is pure and fast to unit-test. The write path
 * (logGeminiImageUsage) uses the DB and is covered in the cover generator
 * integration tests (ticket 4.4).
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { update: () => ({ set: () => ({ where: async () => {} }) }) },
}));

describe("estimateImageCostUsd", () => {
  test("computes nano-banana-2 cost from image count at $0.045/image", async () => {
    const { estimateImageCostUsd } = await import("@/lib/gemini-image/usage");
    expect(estimateImageCostUsd("gemini-3.1-flash-image-preview", 3)).toBe(
      0.135,
    );
  });

  test("returns 0 on zero images", async () => {
    const { estimateImageCostUsd } = await import("@/lib/gemini-image/usage");
    expect(estimateImageCostUsd("gemini-3.1-flash-image-preview", 0)).toBe(0);
  });

  test("falls back to default rate on unknown model id", async () => {
    const { estimateImageCostUsd } = await import("@/lib/gemini-image/usage");
    const known = estimateImageCostUsd("gemini-3.1-flash-image-preview", 5);
    const unknown = estimateImageCostUsd("gemini-made-up-model", 5);
    expect(unknown).toBe(known);
  });
});
