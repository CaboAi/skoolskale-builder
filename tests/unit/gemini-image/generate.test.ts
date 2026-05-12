/**
 * Unit tests for the Gemini image wrapper.
 *
 * The SDK (`@google/genai`) is mocked at module level — we care about (a) what
 * we send to it and (b) how we parse its response, not its transport. The DB
 * is stubbed so `logGeminiImageUsage` is a no-op; the write path is covered
 * in the cover generator integration tests.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Hoisted per-file. See CLAUDE.md § "Mocking conventions".
const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));

vi.mock("@/lib/env", () => ({
  env: { GOOGLE_AI_API_KEY: "test-key" },
}));

vi.mock("@/lib/db", () => ({
  db: { update: () => ({ set: () => ({ where: async () => {} }) }) },
}));

function mockImageResponse(tag: string) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: {
                data: Buffer.from(tag).toString("base64"),
                mimeType: "image/png",
              },
            },
          ],
        },
      },
    ],
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  generateContentMock.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("generateCoverImages", () => {
  test("loops numVariants times and returns one buffer per call", async () => {
    generateContentMock
      .mockResolvedValueOnce(mockImageResponse("img-1"))
      .mockResolvedValueOnce(mockImageResponse("img-2"))
      .mockResolvedValueOnce(mockImageResponse("img-3"));

    const { generateCoverImages } = await import("@/lib/gemini-image/generate");

    const result = await generateCoverImages({
      prompt: "a cover",
      numVariants: 3,
      packageId: "pkg-1",
    });

    expect(generateContentMock).toHaveBeenCalledTimes(3);
    expect(result.images.map((b) => b.toString())).toEqual([
      "img-1",
      "img-2",
      "img-3",
    ]);
    expect(result.costUsd).toBe(0.135); // 3 * $0.045
  });

  test("fetches reference image and passes it as inlineData", async () => {
    generateContentMock.mockResolvedValueOnce(mockImageResponse("img-1"));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "image/jpeg" },
      arrayBuffer: async () => new TextEncoder().encode("ref-bytes").buffer,
    }) as unknown as typeof fetch;

    const { generateCoverImages } = await import("@/lib/gemini-image/generate");
    await generateCoverImages({
      prompt: "cover",
      referenceImageUrl: "https://example.test/photo.jpg",
      numVariants: 1,
      packageId: "pkg-1",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.test/photo.jpg",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const call = generateContentMock.mock.calls[0][0];
    expect(call.model).toBe("gemini-3.1-flash-image-preview");
    expect(call.contents[0].parts[0]).toEqual({ text: "cover" });
    expect(call.contents[0].parts[1]).toEqual({
      inlineData: {
        data: Buffer.from("ref-bytes").toString("base64"),
        mimeType: "image/jpeg",
      },
    });
  });

  test("omits inlineData when no referenceImageUrl is provided", async () => {
    generateContentMock.mockResolvedValueOnce(mockImageResponse("img-1"));

    const { generateCoverImages } = await import("@/lib/gemini-image/generate");
    await generateCoverImages({
      prompt: "cover",
      numVariants: 1,
      packageId: "pkg-1",
    });

    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts).toEqual([{ text: "cover" }]);
  });

  test("throws if reference image fetch fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    }) as unknown as typeof fetch;

    const { generateCoverImages } = await import("@/lib/gemini-image/generate");

    await expect(
      generateCoverImages({
        prompt: "cover",
        referenceImageUrl: "https://example.test/missing.jpg",
        numVariants: 1,
        packageId: "pkg-1",
      }),
    ).rejects.toThrow(/reference fetch failed: 404/);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test("throws if response has no inlineData", async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [{ content: { parts: [] } }],
    });
    const { generateCoverImages } = await import("@/lib/gemini-image/generate");

    await expect(
      generateCoverImages({
        prompt: "cover",
        numVariants: 1,
        packageId: "pkg-1",
      }),
    ).rejects.toThrow(/no inlineData/);
  });

  test("rejects numVariants < 1", async () => {
    const { generateCoverImages } = await import("@/lib/gemini-image/generate");
    await expect(
      generateCoverImages({
        prompt: "cover",
        numVariants: 0,
        packageId: "pkg-1",
      }),
    ).rejects.toThrow(/numVariants must be >= 1/);
  });

  test("passes an AbortSignal in config to the SDK", async () => {
    generateContentMock.mockResolvedValueOnce(mockImageResponse("img-1"));
    const { generateCoverImages } = await import("@/lib/gemini-image/generate");

    await generateCoverImages({
      prompt: "cover",
      numVariants: 1,
      packageId: "pkg-1",
    });

    const call = generateContentMock.mock.calls[0][0];
    expect(call.config?.abortSignal).toBeInstanceOf(AbortSignal);
  });

  test("rejects with timeout error when SDK hangs past the ceiling", async () => {
    vi.useFakeTimers();
    // Hanging promise: never resolves, never rejects on its own. The wrapper's
    // setTimeout-based withTimeout is what must fire.
    generateContentMock.mockImplementation(
      () => new Promise(() => {}) as Promise<never>,
    );
    const { generateCoverImages } = await import("@/lib/gemini-image/generate");

    const promise = generateCoverImages({
      prompt: "cover",
      numVariants: 1,
      packageId: "pkg-1",
    });
    // Attach the rejection handler before advancing time so the rejection
    // isn't reported as unhandled when fake timers fire synchronously.
    const assertion = expect(promise).rejects.toThrow(
      /generateContent variant 1\/1 exceeded 120000ms — retrying/,
    );
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
    vi.useRealTimers();
  });
});
