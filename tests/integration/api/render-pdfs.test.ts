/**
 * Integration tests for POST /api/packages/[id]/handover/render-pdfs — the
 * PDF-only retry that recovers a run whose copy generated but whose PDFs
 * never rendered, without paying Opus again.
 *
 * Pattern follows tests/integration/api/handover.test.ts: vi.hoisted spies,
 * mocked requireUser / db / inngest.send / logAudit, the route handler
 * invoked with a NextRequest + params Promise. The db mock dispatches on the
 * drizzle table object a select targets (identities filled in after the
 * schema import) so the active-run query and the target-document query get
 * independent fixtures.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const NEWEST_RUN_ID = "00000000-0000-4000-8000-0000000000bb";
const OLDER_RUN_ID = "00000000-0000-4000-8000-0000000000cc";

const { state, holder, requireUserMock, logAuditMock, inngestSendMock, dbMock } =
  vi.hoisted(() => {
    type Row = Record<string, unknown>;
    const state = {
      runs: [] as Row[],
      docs: [] as Row[],
      updates: [] as { table: unknown; payload: Row }[],
      // Order matters for the stale-UI regression: the run must be flipped
      // to queued BEFORE the event goes out, or the client's post-response
      // refetch sees a non-active run and never starts polling.
      calls: [] as string[],
    };
    const holder: {
      handoverRuns?: unknown;
      handoverDocuments?: unknown;
    } = {};
    const rowsFor = (table: unknown): Row[] => {
      if (table === holder.handoverRuns) return state.runs;
      if (table === holder.handoverDocuments) return state.docs;
      return [];
    };
    // Query surface used by the route: where().limit(1) (active run) and
    // where().orderBy().limit(1) (newest run that has documents). Rows come
    // back in fixture order, which stands in for the DB's own ordering.
    const whereChain = (table: unknown) =>
      Object.assign(
        Promise.resolve().then(() => rowsFor(table)),
        {
          limit: async () => rowsFor(table),
          orderBy: () =>
            Object.assign(
              Promise.resolve().then(() => rowsFor(table)),
              { limit: async () => rowsFor(table) },
            ),
        },
      );
    return {
      state,
      holder,
      requireUserMock: vi.fn<() => Promise<{ id: string; email: string }>>(
        async () => ({
          id: "00000000-0000-0000-0000-000000000001",
          email: "t@e.com",
        }),
      ),
      logAuditMock: vi.fn<
        (
          userId: string,
          action: string,
          entityType: string,
          entityId: string | null,
          payload: unknown,
        ) => Promise<void>
      >(async () => undefined),
      inngestSendMock: vi.fn<
        (event: {
          name: string;
          data: Record<string, unknown>;
        }) => Promise<{ ids: string[] }>
      >(async () => {
        state.calls.push("send");
        return { ids: ["evt-1"] };
      }),
      dbMock: {
        select: () => ({
          from: (table: unknown) => ({ where: () => whereChain(table) }),
        }),
        update: (table: unknown) => ({
          set: (payload: Row) => ({
            where: async () => {
              state.updates.push({ table, payload });
              state.calls.push("update");
            },
          }),
        }),
      },
    };
  });

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: inngestSendMock },
  Events: { HandoverPdfsRequested: "handover.pdfs.requested" },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { POST } from "@/app/api/packages/[id]/handover/render-pdfs/route";
import { handoverRuns, handoverDocuments } from "@/lib/db/schema";

holder.handoverRuns = handoverRuns;
holder.handoverDocuments = handoverDocuments;

function postRequest() {
  return new NextRequest("http://test/handover/render-pdfs", { method: "POST" });
}

function ctx(id: string = PKG_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: USER_ID, email: "t@e.com" });
  // Keep the call-order recording — a bare mockResolvedValue would replace
  // the implementation and silently defeat the ordering assertion below.
  inngestSendMock.mockImplementation(async () => {
    state.calls.push("send");
    return { ids: ["evt-1"] };
  });
  state.runs = [];
  state.docs = [{ runId: NEWEST_RUN_ID }];
  state.updates.length = 0;
  state.calls.length = 0;
});

describe("POST /api/packages/[id]/handover/render-pdfs", () => {
  test("400 invalid_id on a non-uuid package id", async () => {
    const res = await POST(postRequest(), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_id" });
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  test("409 already_running when a queued or running run exists", async () => {
    state.runs = [{ id: "run-active" }];
    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "already_running" });
    // Firing a second render while one is in flight would race the first
    // over the same storage paths and run row.
    expect(inngestSendMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  test("409 no_documents when the package has no handover documents", async () => {
    state.docs = [];
    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("no_documents");
    expect(body.error).toMatch(/Generate first/);
    // Nothing to render — enqueueing would only fail in the worker.
    expect(inngestSendMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  test("202 targets the newest run that has documents", async () => {
    // Rows arrive DB-ordered newest-first (createdAt desc); the route takes
    // the first, so an older run's leftover documents must not win.
    state.docs = [{ runId: NEWEST_RUN_ID }, { runId: OLDER_RUN_ID }];

    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({
      status: "queued",
      runId: NEWEST_RUN_ID,
    });
  });

  test("202 emits handover.pdfs.requested with the package, run and user", async () => {
    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(202);

    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    expect(inngestSendMock.mock.calls[0][0]).toEqual({
      name: "handover.pdfs.requested",
      data: {
        packageId: PKG_ID,
        runId: NEWEST_RUN_ID,
        userId: USER_ID,
      },
    });
  });

  test("202 writes a handover.pdfs audit row against the target run", async () => {
    await POST(postRequest(), ctx());

    expect(logAuditMock).toHaveBeenCalledTimes(1);
    const audit = logAuditMock.mock.calls[0];
    expect(audit[0]).toBe(USER_ID);
    expect(audit[1]).toBe("handover.pdfs");
    expect(audit[2]).toBe("handover_run");
    expect(audit[3]).toBe(NEWEST_RUN_ID);
    expect(audit[4]).toMatchObject({ packageId: PKG_ID });
  });

  test("202 flips the run to queued and clears the stale error", async () => {
    await POST(postRequest(), ctx());

    const runUpdate = state.updates.find((u) => u.table === handoverRuns);
    expect(runUpdate?.payload).toMatchObject({
      status: "queued",
      error: null,
    });
  });

  test("202 marks the run queued BEFORE emitting the event", async () => {
    // Regression: the client refetches as soon as this responds. If the run
    // were still 'failed' at that moment the UI would see a non-active run,
    // never begin polling, and sit on the stale error while the render was
    // already running — which is exactly what happened in production.
    await POST(postRequest(), ctx());

    expect(state.calls).toEqual(["update", "send"]);
  });
});
