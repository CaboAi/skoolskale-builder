/**
 * Per-image-fn editedPrompt skip-builder coverage (PR #15 follow-up).
 *
 * Single-variant twin of generate-classroom-cover.test.ts. Identical
 * shape, different module key + builder.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  buildCalendarCoverPromptMock,
  imageProviderGenerateMock,
  uploadMock,
  insertValuesMock,
} = vi.hoisted(() => ({
  buildCalendarCoverPromptMock: vi.fn<(...args: unknown[]) => string>(
    () => "BUILT BY THE BUILDER",
  ),
  imageProviderGenerateMock: vi.fn<
    (input: { prompt: string }) => Promise<{ images: Buffer[]; costUsd: number }>
  >(async () => ({ images: [Buffer.from("img")], costUsd: 0.045 })),
  uploadMock: vi.fn(async () => ({ error: null })),
  insertValuesMock: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      handler: (ctx: { event: unknown; step: unknown; runId: string }) => unknown,
    ) => handler,
  },
}));

vi.mock("@/prompts/calendar_cover", () => ({
  buildCalendarCoverPrompt: buildCalendarCoverPromptMock,
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
        // Intentionally NO getPublicUrl mock — Stage 4 dropped the call.
      }),
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (payload: unknown) => {
        insertValuesMock(payload);
        return {
          returning: async () => [{ id: "asset-1" }],
        };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
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

import { generateCalendarCover } from "@/lib/inngest/functions/generate-calendar-cover";

type EventData = {
  packageId: string;
  userId: string;
  editedPrompt?: string;
  regenerateNote?: string;
};

function makeStep() {
  return {
    run: async <T>(_name: string, fn: () => T | Promise<T>) => await fn(),
  };
}

async function runHandler(data: EventData) {
  const handler = generateCalendarCover as unknown as (ctx: {
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
  buildCalendarCoverPromptMock.mockReturnValue("BUILT BY THE BUILDER");
  imageProviderGenerateMock.mockResolvedValue({
    images: [Buffer.from("img")],
    costUsd: 0.045,
  });
});

describe("generateCalendarCover editedPrompt branch", () => {
  test("WITHOUT editedPrompt: builder called once; image provider receives builder output", async () => {
    await runHandler({ packageId: "pkg-1", userId: "user-1" });
    expect(buildCalendarCoverPromptMock).toHaveBeenCalledTimes(1);
    expect(imageProviderGenerateMock).toHaveBeenCalledTimes(1);
    expect(imageProviderGenerateMock.mock.calls[0][0].prompt).toBe(
      "BUILT BY THE BUILDER",
    );
  });

  test("WITH editedPrompt: builder NOT called; image provider receives edited string", async () => {
    await runHandler({
      packageId: "pkg-1",
      userId: "user-1",
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    expect(buildCalendarCoverPromptMock).not.toHaveBeenCalled();
    expect(imageProviderGenerateMock).toHaveBeenCalledTimes(1);
    expect(imageProviderGenerateMock.mock.calls[0][0].prompt).toBe(
      "EDITED PROMPT FROM THE VA",
    );
  });

  test("WITH editedPrompt: regenerateNote is ignored", async () => {
    await runHandler({
      packageId: "pkg-1",
      userId: "user-1",
      regenerateNote: "softer please",
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    expect(buildCalendarCoverPromptMock).not.toHaveBeenCalled();
    const passed = imageProviderGenerateMock.mock.calls[0][0].prompt;
    expect(passed).toBe("EDITED PROMPT FROM THE VA");
    expect(passed).not.toContain("softer please");
  });
});

describe("generateCalendarCover signed-URLs Stage 4 contract", () => {
  test("persists storagePath and url:'' (no public URL)", async () => {
    await runHandler({ packageId: "pkg-1", userId: "user-1" });

    const assetPayload = insertValuesMock.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((p) => p.module === "calendar_cover" && "content" in p);

    expect(assetPayload).toBeDefined();
    expect(assetPayload).toMatchObject({
      packageId: "pkg-1",
      module: "calendar_cover",
      content: {
        variants: [
          {
            url: "",
            storagePath: "pkg-1/calendar_cover/variant-0.png",
            index: 0,
          },
        ],
      },
    });
  });
});
