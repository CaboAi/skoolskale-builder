/**
 * Integration tests for /api/packages/[id]/handover (POST enqueue + GET poll).
 *
 * Pattern follows tests/integration/api/regenerate.test.ts: vi.hoisted spies,
 * mocked requireUser / db / inngest.send / logAudit, route handlers invoked
 * with a NextRequest + params Promise. The db mock dispatches on the drizzle
 * table object a select targets (identities filled in after the schema
 * import) so POST's four queries and GET's two get independent fixtures.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const RUN_ID = "00000000-0000-4000-8000-0000000000bb";

const { state, holder, requireUserMock, logAuditMock, inngestSendMock, dbMock } =
  vi.hoisted(() => {
    type Row = Record<string, unknown>;
    const state = {
      packages: [] as Row[],
      assets: [] as Row[],
      runs: [] as Row[],
      docs: [] as Row[],
      inserted: [] as Row[],
      updates: [] as { table: unknown; payload: Row }[],
      // Per-test hook simulating the stale-run failover's WHERE clause:
      // the mock can't evaluate lt(createdAt, cutoff), so tests that model
      // a stale run make this remove it from the active set.
      onRunsUpdate: undefined as ((payload: Row) => void) | undefined,
    };
    const holder: {
      launchPackages?: unknown;
      generatedAssets?: unknown;
      handoverRuns?: unknown;
      handoverDocuments?: unknown;
    } = {};
    const rowsFor = (table: unknown): Row[] => {
      if (table === holder.launchPackages) return state.packages;
      if (table === holder.generatedAssets) return state.assets;
      if (table === holder.handoverRuns) return state.runs;
      if (table === holder.handoverDocuments) return state.docs;
      return [];
    };
    // Query surface used by the route: where() awaited directly (assets),
    // where().limit(1) (pkg, active run), where().orderBy().limit(1)
    // (latest run), where().orderBy() awaited (doc rows).
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
      >(async () => ({ ids: ["evt-1"] })),
      dbMock: {
        select: () => ({
          from: (table: unknown) => ({ where: () => whereChain(table) }),
        }),
        insert: () => ({
          values: (row: Row) => {
            state.inserted.push(row);
            return {
              returning: async () => [
                { id: "00000000-0000-4000-8000-0000000000bb" },
              ],
            };
          },
        }),
        update: (table: unknown) => ({
          set: (payload: Row) => ({
            where: async () => {
              state.updates.push({ table, payload });
              state.onRunsUpdate?.(payload);
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
  Events: { HandoverGenerateRequested: "handover.generate.requested" },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET, POST } from "@/app/api/packages/[id]/handover/route";
import {
  launchPackages,
  generatedAssets,
  handoverRuns,
  handoverDocuments,
} from "@/lib/db/schema";
import { REQUIRED_FOR_EXPORT } from "@/lib/modules/registry";

holder.launchPackages = launchPackages;
holder.generatedAssets = generatedAssets;
holder.handoverRuns = handoverRuns;
holder.handoverDocuments = handoverDocuments;

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest("http://test/handover", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers:
      body !== undefined ? { "content-type": "application/json" } : undefined,
  });
}

function ctx(id: string = PKG_ID) {
  return { params: Promise.resolve({ id }) };
}

function docRow(overrides: Record<string, unknown>) {
  return {
    id: "doc-1",
    runId: RUN_ID,
    docKey: "readme",
    version: 1,
    pdfPath: null,
    wordCount: 100,
    placeholderCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: USER_ID, email: "t@e.com" });
  inngestSendMock.mockResolvedValue({ ids: ["evt-1"] });
  state.inserted.length = 0;
  state.updates.length = 0;
  state.onRunsUpdate = undefined;
  state.packages = [{ id: PKG_ID, creatorId: "cr-1" }];
  state.assets = REQUIRED_FOR_EXPORT.map((module) => ({
    module,
    approved: true,
  }));
  state.runs = [];
  state.docs = [];
});

describe("POST /api/packages/[id]/handover", () => {
  test("400 invalid_id on a non-uuid package id", async () => {
    const res = await POST(jsonRequest("POST", {}), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_id" });
  });

  test("404 not_found when the package does not exist", async () => {
    state.packages = [];
    const res = await POST(jsonRequest("POST", {}), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "not_found" });
  });

  test("409 not_ready when required modules lack approved assets", async () => {
    state.assets = REQUIRED_FOR_EXPORT.map((module) => ({
      module,
      approved: false,
    }));
    const res = await POST(jsonRequest("POST", {}), ctx());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("not_ready");
    expect(body.error).toMatch(/unapproved modules/);
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  test("409 already_running when a fresh active run exists", async () => {
    state.runs = [{ id: "run-active" }];
    const res = await POST(jsonRequest("POST", {}), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "already_running" });
    expect(state.inserted).toHaveLength(0);
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  test("stale active run is failed over and the new request proceeds", async () => {
    // The mock can't evaluate the lt(createdAt, cutoff) predicate, so the
    // hook models its effect: the stale run stops matching queued/running.
    state.runs = [{ id: "run-stale", status: "running" }];
    state.onRunsUpdate = (payload) => {
      if (payload.status === "failed") state.runs = [];
    };

    const res = await POST(jsonRequest("POST", {}), ctx());
    expect(res.status).toBe(202);

    const failover = state.updates.find((u) => u.payload.status === "failed");
    expect(failover).toBeDefined();
    expect(failover?.payload.error).toMatch(/unresponsive/);
    expect(state.inserted).toHaveLength(1);
    expect(inngestSendMock).toHaveBeenCalledTimes(1);
  });

  test("202 happy path: inserts the run, emits the Inngest event, audits", async () => {
    const res = await POST(
      jsonRequest("POST", { includeGuestEmails: true }),
      ctx(),
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "queued", runId: RUN_ID });

    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      packageId: PKG_ID,
      status: "queued",
      includeGuestEmails: true,
      createdBy: USER_ID,
    });

    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    expect(inngestSendMock.mock.calls[0][0]).toEqual({
      name: "handover.generate.requested",
      data: {
        packageId: PKG_ID,
        runId: RUN_ID,
        userId: USER_ID,
        includeGuestEmails: true,
      },
    });

    expect(logAuditMock).toHaveBeenCalledTimes(1);
    const audit = logAuditMock.mock.calls[0];
    expect(audit[1]).toBe("handover.generate");
    expect(audit[3]).toBe(RUN_ID);
    expect(audit[4]).toMatchObject({
      packageId: PKG_ID,
      includeGuestEmails: true,
    });
  });

  test("202 with an empty body defaults includeGuestEmails to false", async () => {
    const res = await POST(jsonRequest("POST"), ctx());
    expect(res.status).toBe(202);
    expect(inngestSendMock.mock.calls[0][0].data.includeGuestEmails).toBe(
      false,
    );
    expect(state.inserted[0].includeGuestEmails).toBe(false);
  });
});

describe("GET /api/packages/[id]/handover", () => {
  test("400 invalid_id on a non-uuid package id", async () => {
    const res = await GET(jsonRequest("GET"), ctx("nope"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_id" });
  });

  test("returns { run, documents } collapsing to the latest row per docKey", async () => {
    const run = {
      id: RUN_ID,
      packageId: PKG_ID,
      status: "done",
      includeGuestEmails: false,
      error: null,
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    state.runs = [run];
    // Rows arrive DB-ordered newest-first; the route keeps the first per
    // key. v2 hasn't rendered its PDF yet, but v1 did — pdfAvailable must
    // stay true (the download route serves the newest row WITH a pdfPath).
    state.docs = [
      docRow({ id: "doc-v2", docKey: "vsl_and_cancellation", version: 2 }),
      docRow({
        id: "doc-v1",
        docKey: "vsl_and_cancellation",
        version: 1,
        pdfPath: "pkg/run/01-vsl-and-cancellation.pdf",
      }),
      docRow({ id: "doc-readme", docKey: "readme", version: 1 }),
    ];

    const res = await GET(jsonRequest("GET"), ctx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      run: Record<string, unknown>;
      documents: Record<string, unknown>[];
    };
    expect(body.run).toEqual(run);
    expect(body.documents).toHaveLength(2);
    const vsl = body.documents.find(
      (d) => d.docKey === "vsl_and_cancellation",
    );
    expect(vsl).toMatchObject({ id: "doc-v2", version: 2, pdfAvailable: true });
    const readme = body.documents.find((d) => d.docKey === "readme");
    expect(readme).toMatchObject({ pdfAvailable: false });
  });

  test("returns run: null and empty documents when nothing exists yet", async () => {
    const res = await GET(jsonRequest("GET"), ctx());
    expect(await res.json()).toEqual({ run: null, documents: [] });
  });
});
