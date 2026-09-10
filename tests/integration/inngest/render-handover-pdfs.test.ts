/**
 * Integration tests for the PDF-only retry
 * (src/lib/inngest/functions/render-handover-pdfs.ts).
 *
 * Handler extraction and the fake step runner follow
 * generate-handover.test.ts: the Inngest function object exposes its handler
 * as the public `fn` field, so we call it directly with
 * `step = { run: (id, fn) => fn() }` and the steps execute inline in order.
 *
 * What we prove:
 *   (a) the run is flipped back to `running` with its stale error cleared,
 *       then the stored documents are handed to the PDF renderer once
 *   (b) the run is finalized under the handover.pdfs.completed action, so a
 *       run that died at rendering ends up genuinely `done`
 *   (c) a run with no documents throws instead of rendering nothing
 *   (d) THE POINT OF THE FEATURE: no Claude call happens — the retry costs
 *       no AI spend. Asserted twice over: the generateHandoverDoc spy is
 *       never called, and the Claude module is never even imported.
 *
 * All mutable state lives in vi.hoisted (never closure-captured inside a
 * vi.mock factory) so nothing leaks across parallel workers.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  state,
  dbMock,
  logAuditMock,
  renderPdfsMock,
  finalizeHandoverRunMock,
  loadRunDocumentsMock,
  generateHandoverDocMock,
} = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = {
    updates: [] as { table: unknown; payload: Row }[],
    stepIds: [] as string[],
    // Set from inside the Claude mock factory, which only runs if something
    // in the import graph actually pulls the module in.
    claudeModuleLoaded: false,
  };
  return {
    state,
    dbMock: {
      update: (table: unknown) => ({
        set: (payload: Row) => ({
          where: () => {
            state.updates.push({ table, payload });
            return Object.assign(Promise.resolve(), {
              returning: async () => [{ id: "run-transitioned" }],
            });
          },
        }),
      }),
    },
    logAuditMock: vi.fn<(...args: unknown[]) => Promise<void>>(
      async () => undefined,
    ),
    renderPdfsMock: vi.fn<(params: unknown) => Promise<{ rendered: number }>>(),
    finalizeHandoverRunMock:
      vi.fn<(params: Record<string, string>) => Promise<unknown>>(),
    loadRunDocumentsMock: vi.fn<(runId: string) => Promise<Row[]>>(),
    generateHandoverDocMock: vi.fn<(params: unknown) => Promise<unknown>>(),
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("@/lib/handover/pdf-step", () => ({
  renderHandoverDocPdfs: renderPdfsMock,
}));
vi.mock("@/lib/handover/finalize", () => ({
  finalizeHandoverRun: finalizeHandoverRunMock,
  loadRunDocuments: loadRunDocumentsMock,
}));
vi.mock("@/lib/claude/generate-handover", () => {
  state.claudeModuleLoaded = true;
  return { generateHandoverDoc: generateHandoverDocMock };
});

import { renderHandoverPdfs } from "@/lib/inngest/functions/render-handover-pdfs";
import { handoverRuns as handoverRunsTable } from "@/lib/db/schema";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const RUN_ID = "00000000-0000-4000-8000-0000000000bb";
const USER_ID = "00000000-0000-0000-0000-000000000001";

const USAGE = {
  model: "claude-opus-4-8",
  inputTokens: 4_398,
  outputTokens: 38_148,
  cacheReadTokens: 33_376,
  cacheWriteTokens: 8_344,
  durationMs: 687_039,
  costUsd: 0.6452,
};

function storedDocs() {
  return [
    { id: "doc-readme", docKey: "readme", contentMd: "# Sanctuary — Launch Handover" },
    { id: "doc-01", docKey: "vsl_and_cancellation", contentMd: "# VSL" },
    { id: "doc-05", docKey: "dm_sequences", contentMd: "# DMs" },
  ];
}

/* --------------------------- handler plumbing ---------------------------- */

type HandlerCtx = {
  event: { name: string; data: Record<string, unknown> };
  step: { run: (id: string, fn: () => unknown) => Promise<unknown> };
};

const handler = (
  renderHandoverPdfs as unknown as { fn: (ctx: HandlerCtx) => Promise<unknown> }
).fn;

function invoke(overrides: Record<string, unknown> = {}) {
  return handler({
    event: {
      name: "handover.pdfs.requested",
      data: {
        packageId: PKG_ID,
        runId: RUN_ID,
        userId: USER_ID,
        ...overrides,
      },
    },
    step: {
      run: async (id, fn) => {
        state.stepIds.push(id);
        return fn();
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.updates.length = 0;
  state.stepIds.length = 0;
  loadRunDocumentsMock.mockResolvedValue(storedDocs());
  renderPdfsMock.mockResolvedValue({ rendered: 6 });
  finalizeHandoverRunMock.mockResolvedValue(USAGE);
});

/* -------------------------------- tests ---------------------------------- */

describe("renderHandoverPdfs", () => {
  test("(a) flips the run to running with the stale error cleared", async () => {
    await invoke();

    const running = state.updates.find((u) => u.payload.status === "running");
    expect(running?.table).toBe(handoverRunsTable);
    // The run being retried is `failed` with a render-step message on it;
    // leaving that in place would misreport a recovered run as broken.
    expect(running?.payload.error).toBeNull();
  });

  test("(a) renders the run's stored documents exactly once", async () => {
    await invoke();

    expect(loadRunDocumentsMock).toHaveBeenCalledWith(RUN_ID);
    expect(renderPdfsMock).toHaveBeenCalledTimes(1);
    expect(renderPdfsMock.mock.calls[0][0]).toEqual({
      packageId: PKG_ID,
      runId: RUN_ID,
      docs: storedDocs(),
    });
  });

  test("(a) steps run in order: mark-running → render-pdfs → finalize", async () => {
    await invoke();
    expect(state.stepIds).toEqual(["mark-running", "render-pdfs", "finalize"]);
  });

  test("(b) finalizes the run under the handover.pdfs.completed action", async () => {
    const result = (await invoke()) as {
      runId: string;
      rendered: { rendered: number };
      usage: typeof USAGE;
    };

    expect(finalizeHandoverRunMock).toHaveBeenCalledTimes(1);
    expect(finalizeHandoverRunMock.mock.calls[0][0]).toEqual({
      runId: RUN_ID,
      packageId: PKG_ID,
      userId: USER_ID,
      action: "handover.pdfs.completed",
    });
    expect(result).toEqual({
      runId: RUN_ID,
      rendered: { rendered: 6 },
      usage: USAGE,
    });
  });

  test("(c) throws and skips rendering when the run has no documents", async () => {
    loadRunDocumentsMock.mockResolvedValue([]);

    await expect(invoke()).rejects.toThrow(
      new RegExp(`handover run ${RUN_ID} has no documents`),
    );
    expect(renderPdfsMock).not.toHaveBeenCalled();
    expect(finalizeHandoverRunMock).not.toHaveBeenCalled();
  });

  test("(d) the retry spends nothing on Claude", async () => {
    await invoke();

    // The whole reason this function exists: generation costs ~$0.65 of Opus
    // per package, rendering is free. A retry that re-generated identical
    // copy would defeat the feature.
    expect(generateHandoverDocMock).not.toHaveBeenCalled();
    expect(state.claudeModuleLoaded).toBe(false);
  });
});
