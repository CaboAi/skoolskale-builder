/**
 * Unit tests for the Gemini ImageProvider adapter.
 *
 * The adapter is a thin passthrough to generateCoverImages — these tests
 * lock the contract: arg passthrough, modelUsed reporting, and width/height
 * acceptance even though Gemini ignores them.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Hoisted per-file. See CLAUDE.md § "Mocking conventions".
const { generateCoverImagesMock } = vi.hoisted(() => ({
  generateCoverImagesMock: vi.fn(),
}));

vi.mock("@/lib/gemini-image/generate", () => ({
  DEFAULT_MODEL: "gemini-3.1-flash-image-preview",
  generateCoverImages: generateCoverImagesMock,
}));

beforeEach(() => {
  generateCoverImagesMock.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe("geminiProvider.generate", () => {
  test("passes prompt, reference, numVariants, packageId, jobId, model through", async () => {
    generateCoverImagesMock.mockResolvedValueOnce({
      images: [Buffer.from("a"), Buffer.from("b")],
      costUsd: 0.09,
    });
    const { geminiProvider } = await import("@/lib/image-providers/gemini");

    await geminiProvider.generate({
      prompt: "an icon",
      referenceImageUrl: "https://example.test/ref.png",
      numVariants: 2,
      width: 512,
      height: 512,
      packageId: "pkg-7",
      jobId: "job-3",
      model: "gemini-3.1-flash-image-preview",
    });

    expect(generateCoverImagesMock).toHaveBeenCalledWith({
      prompt: "an icon",
      referenceImageUrl: "https://example.test/ref.png",
      numVariants: 2,
      packageId: "pkg-7",
      jobId: "job-3",
      model: "gemini-3.1-flash-image-preview",
    });
  });

  test("returns images, costUsd, and modelUsed (defaults to DEFAULT_MODEL)", async () => {
    generateCoverImagesMock.mockResolvedValueOnce({
      images: [Buffer.from("img")],
      costUsd: 0.045,
    });
    const { geminiProvider } = await import("@/lib/image-providers/gemini");

    const result = await geminiProvider.generate({
      prompt: "p",
      numVariants: 1,
      width: 1456,
      height: 816,
      packageId: "pkg-1",
    });

    expect(result).toEqual({
      images: [Buffer.from("img")],
      costUsd: 0.045,
      modelUsed: "gemini-3.1-flash-image-preview",
    });
  });

  test("respects an explicit model override in modelUsed", async () => {
    generateCoverImagesMock.mockResolvedValueOnce({
      images: [Buffer.from("img")],
      costUsd: 0.045,
    });
    const { geminiProvider } = await import("@/lib/image-providers/gemini");

    const result = await geminiProvider.generate({
      prompt: "p",
      numVariants: 1,
      width: 512,
      height: 512,
      packageId: "pkg-1",
      model: "gemini-experimental-future",
    });

    expect(result.modelUsed).toBe("gemini-experimental-future");
  });

  test("name is gemini-nano-banana", async () => {
    const { geminiProvider } = await import("@/lib/image-providers/gemini");
    expect(geminiProvider.name).toBe("gemini-nano-banana");
  });
});

describe("getImageProvider", () => {
  test("returns the Gemini provider by default", async () => {
    const { getImageProvider } = await import("@/lib/image-providers");
    const { geminiProvider } = await import("@/lib/image-providers/gemini");
    expect(getImageProvider()).toBe(geminiProvider);
  });
});
