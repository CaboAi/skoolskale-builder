/**
 * Sequential image pipeline.
 *
 * Proves the five properties the design rests on:
 *   1. Provider calls are STRICTLY serial — call N finishes before N+1 starts.
 *   2. One failed slot does not kill the run; the loop continues and the run
 *      still finalizes.
 *   3. The style anchor (first successful banner) is passed as a reference to
 *      later banners, and never to the icon.
 *   4. An existing (runId, slotKey) row short-circuits instead of double
 *      inserting.
 *   5. A run with no pinned style spec is a NonRetriableError, not a retry
 *      loop against the provider.
 *
 * Convention (CLAUDE.md): the exported `fn` handler is invoked directly with
 * a fake `step`, and ALL mutable state lives in `vi.hoisted` — closure state
 * inside a `vi.mock` factory leaks across parallel workers and shows up as a
 * timeout in an unrelated file.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const H = vi.hoisted(() => ({
  providerCalls: [] as {
    prompt: string;
    references: { bucket: string; path: string }[];
    startedAt: number;
    endedAt: number;
  }[],
  inFlight: 0,
  maxInFlight: 0,
  failSlots: new Set<string>(),
  insertedAssets: [] as Record<string, unknown>[],
  existingAssets: [] as { runId: string; slotKey: string; status: string; storagePath: string | null }[],
  runUpdates: [] as Record<string, unknown>[],
  finalizeCalls: [] as Record<string, unknown>[],
  uploads: [] as { bucket: string; path: string }[],
  pinnedSpec: true,
  slotDelays: new Map<string, number>(),
}));

vi.mock("@/lib/image-providers", () => ({
  getImageProvider: () => ({
    name: "openai-gpt-image-1",
    generate: async (args: {
      prompt: string;
      referenceImages?: { bucket?: string; path?: string }[];
    }) => {
      const startedAt = Date.now();
      H.inFlight += 1;
      H.maxInFlight = Math.max(H.maxInFlight, H.inFlight);

      // Slot identity is recoverable from the prompt's title line.
      const slotMatch = args.prompt.match(/SLOTKEY:(\S+)/);
      const slotKey = slotMatch?.[1] ?? "unknown";
      await new Promise((r) => setTimeout(r, H.slotDelays.get(slotKey) ?? 5));

      H.inFlight -= 1;
      H.providerCalls.push({
        prompt: args.prompt,
        references: (args.referenceImages ?? []).map((r) => ({
          bucket: r.bucket ?? "",
          path: r.path ?? "",
        })),
        startedAt,
        endedAt: Date.now(),
      });

      if (H.failSlots.has(slotKey)) throw new Error("provider exploded");
      return {
        image: Buffer.from("fake"),
        costUsd: 0.25,
        modelUsed: "gpt-image-1",
        durationMs: 10,
      };
    },
  }),
}));

vi.mock("@/lib/images/post-process", () => ({
  fitToTarget: async (buf: Buffer, target: { width: number; height: number }) => ({
    buffer: buf,
    width: target.width,
    height: target.height,
  }),
}));

vi.mock("@/lib/storage/upload", () => ({
  uploadStorageObject: async (bucket: string, path: string) => {
    H.uploads.push({ bucket, path });
  },
}));

vi.mock("@/lib/images/finalize", () => ({
  finalizeImageRun: async (params: Record<string, unknown>) => {
    H.finalizeCalls.push(params);
    return { imageCount: 0, doneCount: 0, failedCount: 0, costUsd: 0, durationMs: 0 };
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));

// Prompt builder is exercised by its own suite; here it only has to make the
// slot identifiable inside the provider mock.
vi.mock("@/prompts/images/build-prompt", () => ({
  buildSlotPrompt: ({ slot }: { slot: { key: string } }) =>
    `SLOTKEY:${slot.key} prompt body`,
}));

vi.mock("@/lib/images/plan-source", async () => {
  const actual = await vi.importActual<typeof import("@/lib/images/slots")>(
    "@/lib/images/slots",
  );
  const plan = actual.planSlots({
    communityName: "The Calm Closer",
    classroomTitles: ["Foundations", "The Reset"],
    calendarTitles: [],
  });
  return {
    IMAGE_SLOTS_BUCKET: "image-slots",
    IMAGE_REFERENCES_BUCKET: "image-references",
    loadImageSource: async () => ({
      package: { id: "pkg-1" },
      creator: { communityName: "The Calm Closer" },
      plan,
      references: [
        { kind: "brand_kit", path: "pkg-1/brand.png", bucket: "image-references" },
      ],
      missingModules: [],
    }),
    loadPinnedStyleSpec: async () =>
      H.pinnedSpec
        ? { id: "spec-1", version: 1, source: "generated", spec: { peoplePolicy: "no_people" } }
        : null,
  };
});

vi.mock("@/types/generators", () => ({
  toCreatorContext: () => ({ community_name: "The Calm Closer" }),
}));

vi.mock("@/lib/db", () => {
  const selectBuilder = (rows: unknown[]) => {
    const b: Record<string, unknown> = {};
    b.from = () => b;
    b.where = () => b;
    b.orderBy = () => b;
    b.limit = async () => rows;
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
    return b;
  };

  return {
    db: {
      select: (cols?: Record<string, unknown>) => {
        const keys = Object.keys(cols ?? {});
        // The version lookup asks for { version }; the idempotency guard asks
        // for { status, storagePath }.
        if (keys.includes("version")) return selectBuilder([]);
        return selectBuilder(H.existingAssets.map((a) => ({ ...a })));
      },
      insert: () => ({
        values: async (v: Record<string, unknown>) => {
          H.insertedAssets.push(v);
        },
      }),
      update: () => ({
        set: (v: Record<string, unknown>) => ({
          where: async () => {
            H.runUpdates.push(v);
          },
        }),
      }),
    },
  };
});

import { generateImages } from "@/lib/inngest/functions/generate-images";

type StepFn = { run: (id: string, fn: () => unknown) => Promise<unknown> };

const step: StepFn = { run: (_id, fn) => Promise.resolve(fn()) };

function invoke(slotKeys: string[]) {
  const handler = (generateImages as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;
  return handler({
    event: {
      data: {
        packageId: "pkg-1",
        runId: "run-1",
        userId: "user-1",
        slotKeys,
      },
    },
    step,
    runId: "inngest-run-1",
  });
}

beforeEach(() => {
  H.providerCalls.length = 0;
  H.insertedAssets.length = 0;
  H.existingAssets.length = 0;
  H.runUpdates.length = 0;
  H.finalizeCalls.length = 0;
  H.uploads.length = 0;
  H.failSlots.clear();
  H.slotDelays.clear();
  H.inFlight = 0;
  H.maxInFlight = 0;
  H.pinnedSpec = true;
});

describe("strict serialism", () => {
  test("only one provider call is ever in flight", async () => {
    await invoke(["classroom_cover:0", "classroom_cover:1", "icon:0"]);

    expect(H.providerCalls).toHaveLength(3);
    expect(H.maxInFlight).toBe(1);
  });

  test("each call ends before the next one starts", async () => {
    H.slotDelays.set("classroom_cover:0", 30);
    H.slotDelays.set("classroom_cover:1", 5);

    await invoke(["classroom_cover:0", "classroom_cover:1"]);

    const [first, second] = H.providerCalls;
    expect(second.startedAt).toBeGreaterThanOrEqual(first.endedAt);
  });

  test("slots run in the order the plan supplied", async () => {
    await invoke(["icon:0", "classroom_cover:0", "classroom_cover:1"]);

    expect(H.insertedAssets.map((a) => a.slotKey)).toEqual([
      "icon:0",
      "classroom_cover:0",
      "classroom_cover:1",
    ]);
  });
});

describe("per-slot failure isolation", () => {
  test("a failed slot is recorded and the run continues", async () => {
    H.failSlots.add("classroom_cover:0");

    await invoke(["classroom_cover:0", "classroom_cover:1"]);

    expect(H.insertedAssets).toHaveLength(2);
    expect(H.insertedAssets[0]).toMatchObject({
      slotKey: "classroom_cover:0",
      status: "failed",
    });
    expect(H.insertedAssets[0].error).toContain("provider exploded");
    expect(H.insertedAssets[1]).toMatchObject({
      slotKey: "classroom_cover:1",
      status: "done",
    });
  });

  test("the run still finalizes when a slot failed", async () => {
    H.failSlots.add("classroom_cover:0");

    await invoke(["classroom_cover:0", "classroom_cover:1"]);

    expect(H.finalizeCalls).toHaveLength(1);
    expect(H.finalizeCalls[0]).toMatchObject({
      runId: "run-1",
      action: "images.generate.completed",
    });
  });

  test("a failed slot writes no storage object", async () => {
    H.failSlots.add("classroom_cover:0");

    await invoke(["classroom_cover:0"]);

    expect(H.uploads).toHaveLength(0);
  });
});

describe("style anchor", () => {
  test("the first successful banner becomes a reference for later banners", async () => {
    await invoke(["classroom_cover:0", "classroom_cover:1"]);

    const [first, second] = H.providerCalls;
    expect(first.references.map((r) => r.bucket)).toEqual(["image-references"]);
    expect(second.references.map((r) => r.bucket)).toEqual([
      "image-references",
      "image-slots",
    ]);
    expect(second.references[1].path).toContain("classroom_cover/0");
  });

  test("the icon never receives the banner anchor", async () => {
    await invoke(["classroom_cover:0", "icon:0"]);

    const iconCall = H.providerCalls[1];
    expect(iconCall.references.some((r) => r.bucket === "image-slots")).toBe(
      false,
    );
  });

  test("a failed first banner does not become the anchor", async () => {
    H.failSlots.add("classroom_cover:0");

    await invoke(["classroom_cover:0", "classroom_cover:1"]);

    const secondCall = H.providerCalls[1];
    expect(secondCall.references.some((r) => r.bucket === "image-slots")).toBe(
      false,
    );
  });
});

describe("idempotency and guards", () => {
  test("an existing row for the slot short-circuits without a provider call", async () => {
    H.existingAssets.push({
      runId: "run-1",
      slotKey: "classroom_cover:0",
      status: "done",
      storagePath: "pkg-1/classroom_cover/0/v1.png",
    });

    await invoke(["classroom_cover:0"]);

    expect(H.providerCalls).toHaveLength(0);
    expect(H.insertedAssets).toHaveLength(0);
  });

  test("an unpinned style spec fails fast instead of calling the provider", async () => {
    H.pinnedSpec = false;

    await expect(invoke(["classroom_cover:0"])).rejects.toThrow(
      /no art direction pinned/,
    );
    expect(H.providerCalls).toHaveLength(0);
  });

  test("unknown slot keys fail fast rather than generating nothing quietly", async () => {
    await expect(invoke(["community_cover:0"])).rejects.toThrow(
      /none of the requested slots exist/,
    );
  });

  test("marks the run running before any generation", async () => {
    await invoke(["icon:0"]);

    expect(H.runUpdates[0]).toMatchObject({ status: "running" });
    expect(H.runUpdates[0].inngestRunId).toBe("inngest-run-1");
  });
});
