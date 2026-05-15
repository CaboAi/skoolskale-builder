/**
 * Per-image-fn editedPrompt skip-builder coverage (PR #15 follow-up).
 *
 * Twin of generate-cover.test.ts; differs because icon fans out 3
 * variants by STYLE — each style produces a different prompt via
 * buildIconPrompt. Without editedPrompt, the builder is called once
 * per style (3 times total). With editedPrompt, the builder is NOT
 * called and the same edited string is used for all 3 variants.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  buildIconPromptMock,
  imageProviderGenerateMock,
  uploadMock,
  insertValuesMock,
} = vi.hoisted(() => ({
  buildIconPromptMock: vi.fn<(input: { style: string }) => string>(
    (input) => `BUILT FOR ${input.style.toUpperCase()}`,
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

vi.mock("@/prompts/icon", () => ({
  buildIconPrompt: buildIconPromptMock,
  // Real ICON_STYLES tuple — generateIcon iterates this for fan-out.
  ICON_STYLES: ["geometric", "typographic", "iconic"] as const,
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

import { generateIcon } from "@/lib/inngest/functions/generate-icon";

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
  const handler = generateIcon as unknown as (ctx: {
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
  buildIconPromptMock.mockImplementation(
    (input) => `BUILT FOR ${input.style.toUpperCase()}`,
  );
  imageProviderGenerateMock.mockResolvedValue({
    images: [Buffer.from("img")],
    costUsd: 0.045,
  });
});

describe("generateIcon editedPrompt branch", () => {
  test("WITHOUT editedPrompt: builder called once per ICON_STYLE (3x); each variant gets its own prompt", async () => {
    await runHandler({ packageId: "pkg-1", userId: "user-1" });
    expect(buildIconPromptMock).toHaveBeenCalledTimes(3);
    const prompts = imageProviderGenerateMock.mock.calls.map(
      (c) => c[0].prompt,
    );
    expect(prompts).toEqual([
      "BUILT FOR GEOMETRIC",
      "BUILT FOR TYPOGRAPHIC",
      "BUILT FOR ICONIC",
    ]);
  });

  test("WITH editedPrompt: builder NOT called; all 3 variants use the same edited string", async () => {
    await runHandler({
      packageId: "pkg-1",
      userId: "user-1",
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    expect(buildIconPromptMock).not.toHaveBeenCalled();
    expect(imageProviderGenerateMock).toHaveBeenCalledTimes(3);
    for (const call of imageProviderGenerateMock.mock.calls) {
      expect(call[0].prompt).toBe("EDITED PROMPT FROM THE VA");
    }
  });

  test("WITH editedPrompt: regenerateNote is ignored", async () => {
    await runHandler({
      packageId: "pkg-1",
      userId: "user-1",
      regenerateNote: "softer please",
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    expect(buildIconPromptMock).not.toHaveBeenCalled();
    for (const call of imageProviderGenerateMock.mock.calls) {
      expect(call[0].prompt).toBe("EDITED PROMPT FROM THE VA");
      expect(call[0].prompt).not.toContain("softer please");
    }
  });
});

describe("generateIcon signed-URLs Stage 4 contract", () => {
  test("persists storagePath and url:'' for every variant; never a public URL", async () => {
    await runHandler({ packageId: "pkg-1", userId: "user-1" });

    const assetPayload = insertValuesMock.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((p) => p.module === "icon" && "content" in p);

    expect(assetPayload).toBeDefined();
    const content = assetPayload!.content as {
      variants: { url: string; storagePath: string; index: number }[];
    };
    expect(content.variants).toHaveLength(3);
    for (const v of content.variants) {
      expect(v.url).toBe("");
      expect(v.storagePath).toMatch(/^pkg-1\/icon\/variant-[123]\.png$/);
    }
  });
});
