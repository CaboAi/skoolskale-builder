import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { downloadMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    storage: { from: () => ({ download: downloadMock }) },
  }),
}));

const { envMock } = vi.hoisted(() => ({
  envMock: { OPENAI_API_KEY: "sk-test-key" as string | undefined },
}));

vi.mock("@/lib/env", () => ({ env: envMock }));

import { openAiImageProvider } from "@/lib/image-providers/openai";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function okResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const IMAGE_BODY = {
  data: [{ b64_json: PNG_BASE64 }],
  usage: {
    input_tokens: 1200,
    output_tokens: 4000,
    input_tokens_details: { image_tokens: 700, text_tokens: 500 },
  },
};

const BASE_ARGS = {
  prompt: "a calm banner",
  size: "1536x1024" as const,
  quality: "high" as const,
  background: "opaque" as const,
  packageId: "pkg-1",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  envMock.OPENAI_API_KEY = "sk-test-key";
  downloadMock.mockReset();
  fetchMock = vi.fn().mockResolvedValue(okResponse(IMAGE_BODY));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("endpoint selection", () => {
  test("no references routes to /images/generations as JSON", async () => {
    await openAiImageProvider.generate(BASE_ARGS);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: "gpt-image-1",
      prompt: "a calm banner",
      size: "1536x1024",
      quality: "high",
      n: 1,
      output_format: "png",
      background: "opaque",
    });
  });

  test("references route to /images/edits as multipart with one part each", async () => {
    downloadMock.mockResolvedValue({
      data: {
        type: "image/png",
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      },
      error: null,
    });

    await openAiImageProvider.generate({
      ...BASE_ARGS,
      referenceImages: [
        { kind: "storage", bucket: "image-references", path: "p/headshot.png" },
        { kind: "storage", bucket: "image-references", path: "p/brand.png" },
        { kind: "storage", bucket: "image-slots", path: "p/anchor.png" },
      ],
      hasPortraitReference: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/edits");

    const form = init.body as FormData;
    expect(form.getAll("image[]")).toHaveLength(3);
    expect(form.get("input_fidelity")).toBe("high");
    expect(form.get("size")).toBe("1536x1024");
    expect(form.get("quality")).toBe("high");
  });

  test("input_fidelity is only sent when a portrait is among the references", async () => {
    downloadMock.mockResolvedValue({
      data: {
        type: "image/png",
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      },
      error: null,
    });

    await openAiImageProvider.generate({
      ...BASE_ARGS,
      referenceImages: [
        { kind: "storage", bucket: "image-slots", path: "p/anchor.png" },
      ],
    });

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("input_fidelity")).toBeNull();
  });

  test("transparent background is forwarded for the icon slot", async () => {
    await openAiImageProvider.generate({
      ...BASE_ARGS,
      size: "1024x1024",
      background: "transparent",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.background).toBe("transparent");
  });
});

describe("reference loading", () => {
  test("storage references download service-role instead of over the network", async () => {
    downloadMock.mockResolvedValue({
      data: {
        type: "image/jpeg",
        arrayBuffer: async () => new Uint8Array([9]).buffer,
      },
      error: null,
    });

    await openAiImageProvider.generate({
      ...BASE_ARGS,
      referenceImages: [
        { kind: "storage", bucket: "image-references", path: "p/headshot.jpg" },
      ],
    });

    expect(downloadMock).toHaveBeenCalledWith("p/headshot.jpg");
    // Exactly one fetch: the API call. The reference never went over HTTP.
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("a failed reference download surfaces the bucket and path", async () => {
    downloadMock.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });

    await expect(
      openAiImageProvider.generate({
        ...BASE_ARGS,
        referenceImages: [
          { kind: "storage", bucket: "image-references", path: "p/gone.png" },
        ],
      }),
    ).rejects.toThrow(/image-references\/p\/gone\.png.*Object not found/);
  });
});

describe("result and errors", () => {
  test("returns one decoded image plus cost from the returned token usage", async () => {
    const result = await openAiImageProvider.generate(BASE_ARGS);

    expect(result.image).toBeInstanceOf(Buffer);
    expect(result.image.subarray(1, 4).toString()).toBe("PNG");
    expect(result.modelUsed).toBe("gpt-image-1");
    expect(result.tokens).toEqual({
      inputTokens: 500,
      imageInputTokens: 700,
      outputTokens: 4000,
    });
    // 500/1e6*5 + 700/1e6*10 + 4000/1e6*40 = 0.0025 + 0.007 + 0.16
    expect(result.costUsd).toBeCloseTo(0.1695, 6);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("falls back to the flat rate when the API omits usage", async () => {
    fetchMock.mockResolvedValue(okResponse({ data: [{ b64_json: PNG_BASE64 }] }));

    const result = await openAiImageProvider.generate(BASE_ARGS);
    expect(result.tokens).toBeUndefined();
    expect(result.costUsd).toBe(0.25);
  });

  test("a missing API key throws a named error rather than a 401", async () => {
    envMock.OPENAI_API_KEY = undefined;

    await expect(openAiImageProvider.generate(BASE_ARGS)).rejects.toThrow(
      /OPENAI_API_KEY is not configured/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an API error surfaces status and message", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        statusText: "Too Many Requests",
      }),
    );

    await expect(openAiImageProvider.generate(BASE_ARGS)).rejects.toThrow(
      /429.*rate limited/,
    );
  });

  test("a response with no image data is an error, not an empty buffer", async () => {
    fetchMock.mockResolvedValue(okResponse({ data: [] }));

    await expect(openAiImageProvider.generate(BASE_ARGS)).rejects.toThrow(
      /no image data/,
    );
  });

  test("an abort surfaces as a greppable timeout message", async () => {
    fetchMock.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("The operation was aborted")), 5)),
    );

    await expect(openAiImageProvider.generate(BASE_ARGS)).rejects.toThrow(
      /aborted/,
    );
  });

  test("passes an AbortSignal so a hung call cancels its socket", async () => {
    await openAiImageProvider.generate(BASE_ARGS);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
