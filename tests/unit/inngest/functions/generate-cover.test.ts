/**
 * Per-image-fn editedPrompt skip-builder coverage (PR #15 follow-up).
 *
 * generateCover (and the 3 sibling image fns) implement an
 * `if (data.editedPrompt) { return {prompt: data.editedPrompt, ...}; }`
 * branch in their per-function `prepare` step. Typecheck proves the
 * shape matches; only a runtime test proves the right branch fires
 * with the right value. This file proves it for cover; the 3 sibling
 * test files mirror this pattern.
 *
 * Mocking strategy:
 *   - vi.mock("@/lib/inngest/client") returns a fake `inngest.createFunction`
 *     that yields the handler directly. Importing `generateCover` then gives
 *     us a callable function instead of an InngestFunction wrapper.
 *   - step.run is stubbed to invoke its callback synchronously (no
 *     durability — these tests aren't exercising Inngest's retry/persist
 *     semantics, they're proving which prompt the function uses).
 *   - The prompt builder is mocked so we can assert called/not-called.
 *   - Image provider, Supabase storage, DB inserts/updates, and usage
 *     logger are all stubbed minimally so the handler runs to completion.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

const { buildImagePromptMock, imageProviderGenerateMock, uploadMock } =
  vi.hoisted(() => ({
    buildImagePromptMock: vi.fn<(...args: unknown[]) => string>(
      () => "BUILT BY THE BUILDER",
    ),
    imageProviderGenerateMock: vi.fn<
      (input: { prompt: string }) => Promise<{ images: Buffer[]; costUsd: number }>
    >(async () => ({ images: [Buffer.from("img")], costUsd: 0.045 })),
    uploadMock: vi.fn(async () => ({ error: null })),
  }));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      handler: (ctx: { event: unknown; step: unknown; runId: string }) => unknown,
    ) => handler,
  },
}));

vi.mock("@/prompts/cover", () => ({
  buildImagePrompt: buildImagePromptMock,
}));

vi.mock("@/lib/image-providers", () => ({
  getImageProvider: () => ({
    generate: imageProviderGenerateMock,
    name: "test-provider",
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: () => ({ data: { publicUrl: "https://test/img.png" } }),
      }),
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: "asset-1" }],
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: "pkg-1",
              creatorId: "cr-1",
              createdBy: "user-1",
              name: "Jane",
              communityName: "Sanctuary",
              niche: "spiritual",
              audience: "x",
              transformation: "x",
              tone: "warm",
              offerBreakdown: {},
              pricing: {},
              trialTerms: {},
              refundPolicy: "",
              supportContact: "x",
              brandPrefs: "",
              creatorPhotoUrl: null,
            },
          ],
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/gemini-image/usage", () => ({
  logGeminiImageUsage: vi.fn(async () => undefined),
}));

vi.mock("@/lib/gemini-image/generate", () => ({
  DEFAULT_MODEL: "gemini-3.1-flash-image-preview",
}));

import { generateCover } from "@/lib/inngest/functions/generate-cover";

type EventData = {
  packageId: string;
  userId: string;
  editedPrompt?: string;
  regenerateNote?: string;
};

function makeStep() {
  return {
    run: async <T>(_name: string, fn: () => T | Promise<T>) => {
      return await fn();
    },
  };
}

async function runHandler(data: EventData) {
  // The mocked `inngest.createFunction` returned the handler directly,
  // so `generateCover` is the (event, step, runId) callable.
  const handler = generateCover as unknown as (ctx: {
    event: { data: EventData };
    step: ReturnType<typeof makeStep>;
    runId: string;
  }) => Promise<unknown>;
  return await handler({
    event: { data },
    step: makeStep(),
    runId: "run-test-1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  buildImagePromptMock.mockReturnValue("BUILT BY THE BUILDER");
  imageProviderGenerateMock.mockResolvedValue({
    images: [Buffer.from("img")],
    costUsd: 0.045,
  });
  uploadMock.mockResolvedValue({ error: null });
});

describe("generateCover editedPrompt branch", () => {
  test("WITHOUT editedPrompt: builder called once; image provider receives builder output", async () => {
    await runHandler({ packageId: "pkg-1", userId: "user-1" });
    expect(buildImagePromptMock).toHaveBeenCalledTimes(1);
    // Cover fans out 3 variants; each call to generate should use the
    // builder's prompt.
    for (const call of imageProviderGenerateMock.mock.calls) {
      expect(call[0].prompt).toBe("BUILT BY THE BUILDER");
    }
    expect(imageProviderGenerateMock).toHaveBeenCalled();
  });

  test("WITH editedPrompt: builder NOT called; image provider receives edited string verbatim", async () => {
    await runHandler({
      packageId: "pkg-1",
      userId: "user-1",
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    expect(buildImagePromptMock).not.toHaveBeenCalled();
    expect(imageProviderGenerateMock).toHaveBeenCalled();
    for (const call of imageProviderGenerateMock.mock.calls) {
      expect(call[0].prompt).toBe("EDITED PROMPT FROM THE VA");
    }
  });

  test("WITH editedPrompt: regenerateNote is ignored (no suffix added)", async () => {
    await runHandler({
      packageId: "pkg-1",
      userId: "user-1",
      regenerateNote: "softer please",
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    expect(buildImagePromptMock).not.toHaveBeenCalled();
    for (const call of imageProviderGenerateMock.mock.calls) {
      expect(call[0].prompt).toBe("EDITED PROMPT FROM THE VA");
      expect(call[0].prompt).not.toContain("USER FEEDBACK");
      expect(call[0].prompt).not.toContain("softer please");
    }
  });
});
