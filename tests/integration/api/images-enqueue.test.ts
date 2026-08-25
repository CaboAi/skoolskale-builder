/**
 * Integration tests for POST /api/packages/[id]/images (enqueue) and the
 * single-slot regenerate route.
 *
 * Follows tests/integration/api/handover.test.ts: vi.hoisted spies, mocked
 * requireUser / db / inngest.send / logAudit, handlers invoked with a
 * NextRequest and a params Promise.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const RUN_ID = "00000000-0000-4000-8000-0000000000bb";
const USER_ID = "00000000-0000-0000-0000-000000000001";

const H = vi.hoisted(() => ({
  runs: [] as Record<string, unknown>[],
  inserted: [] as Record<string, unknown>[],
  runUpdates: [] as Record<string, unknown>[],
  sent: [] as { name: string; data: Record<string, unknown> }[],
  audits: [] as { action: string; payload: unknown }[],
  source: null as Record<string, unknown> | null,
  pinned: null as Record<string, unknown> | null,
  // The db mock can't evaluate lt(createdAt, cutoff); tests that model a
  // stale run use this to drop it from the active set on update, exactly as
  // the failover would.
  onRunsUpdate: undefined as (() => void) | undefined,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ id: USER_ID, email: "va@skoolskale.test" }),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: async (
    _userId: string,
    action: string,
    _entityType: string,
    _entityId: string | null,
    payload: unknown,
  ) => {
    H.audits.push({ action, payload });
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: async (event: { name: string; data: Record<string, unknown> }) => {
      H.sent.push(event);
    },
  },
  Events: {
    ImagesGenerateRequested: "images.generate.requested",
    ImagesStyleRequested: "images.style.requested",
  },
}));

vi.mock("@/lib/env", () => ({ env: { OPENAI_API_KEY: "sk-test" } }));

vi.mock("@/lib/images/plan-source", async () => {
  const slots = await vi.importActual<typeof import("@/lib/images/slots")>(
    "@/lib/images/slots",
  );
  return {
    IMAGE_SLOTS_BUCKET: "image-slots",
    IMAGE_REFERENCES_BUCKET: "image-references",
    loadImageSource: async () => H.source,
    loadPinnedStyleSpec: async () => H.pinned,
    nextStyleSpecVersion: async () => 1,
    __slots: slots,
  };
});

vi.mock("@/lib/images/resolve-urls", () => ({
  signPaths: async () => new Map<string, string>(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = () => {
    const rows = () => H.runs.filter((r) => r.status !== "failed");
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.innerJoin = () => chain;
    chain.limit = async () => rows();
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve);
    return chain;
  };

  return {
    db: {
      select: () => selectChain(),
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          returning: async () => {
            H.inserted.push(v);
            return [{ id: RUN_ID }];
          },
        }),
      }),
      update: () => ({
        set: (payload: Record<string, unknown>) => ({
          where: async () => {
            H.runUpdates.push(payload);
            H.onRunsUpdate?.();
          },
        }),
      }),
      delete: () => ({ where: async () => undefined }),
    },
  };
});

import { planSlots } from "@/lib/images/slots";
import { POST } from "@/app/api/packages/[id]/images/route";
import { POST as REGENERATE } from "@/app/api/packages/[id]/images/[slotKind]/[slotIndex]/regenerate/route";

const PLAN = planSlots({
  communityName: "The Calm Closer",
  classroomTitles: ["Foundations", "The Reset"],
  calendarTitles: ["Weekly Q&A"],
});

function baseSource(overrides: Record<string, unknown> = {}) {
  return {
    package: { id: PKG_ID },
    creator: { communityName: "The Calm Closer" },
    plan: PLAN,
    references: [],
    missingModules: [],
    ...overrides,
  };
}

const post = (body: unknown = {}) =>
  POST(
    new NextRequest("http://localhost/api/packages/x/images", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: PKG_ID }) },
  );

const regenerate = (
  slotKind: string,
  slotIndex: string,
  body: unknown = {},
) =>
  REGENERATE(
    new NextRequest("http://localhost/api/packages/x/images/y/z/regenerate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: PKG_ID, slotKind, slotIndex }) },
  );

beforeEach(() => {
  H.runs.length = 0;
  H.inserted.length = 0;
  H.runUpdates.length = 0;
  H.sent.length = 0;
  H.audits.length = 0;
  H.onRunsUpdate = undefined;
  H.source = baseSource();
  H.pinned = { id: "spec-1", version: 1, source: "generated", spec: {} };
});

describe("POST /images — guards", () => {
  test("404s when the package does not exist", async () => {
    H.source = null;
    const res = await post();

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_found");
  });

  test("409 not_ready when copy modules are still unapproved", async () => {
    H.source = baseSource({ missingModules: ["about_us", "start_here"] });
    const res = await post();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("not_ready");
    expect(body.error).toContain("about_us");
    expect(H.sent).toHaveLength(0);
  });

  test("409 no_style_spec when art direction has not been pinned", async () => {
    H.pinned = null;
    const res = await post();

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("no_style_spec");
    expect(H.sent).toHaveLength(0);
  });

  test("409 already_running when a run is queued or running", async () => {
    H.runs.push({ id: "other-run", status: "running" });
    const res = await post();

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("already_running");
    expect(H.inserted).toHaveLength(0);
  });

  test("400 invalid_id for a non-uuid package id", async () => {
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST", body: "{}" }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_id");
  });
});

describe("POST /images — stale failover", () => {
  test("fails over a stale run and lets the new one through", async () => {
    H.runs.push({ id: "stale-run", status: "running" });
    // Model the failover's WHERE: once updated, the stale run is no longer
    // active, so the exclusivity check that follows sees a clear field.
    H.onRunsUpdate = () => {
      H.runs.forEach((r) => {
        r.status = "failed";
      });
    };

    const res = await post();

    expect(res.status).toBe(202);
    expect(H.runUpdates[0]).toMatchObject({ status: "failed" });
    expect(H.runUpdates[0].error).toContain("superseded");
  });
});

describe("POST /images — happy path", () => {
  test("202s with the planned slot count and enqueues the event", async () => {
    const res = await post();

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ status: "queued", runId: RUN_ID });
    expect(body.slotCount).toBe(PLAN.auto.length);

    expect(H.sent).toHaveLength(1);
    expect(H.sent[0].name).toBe("images.generate.requested");
    expect(H.sent[0].data).toMatchObject({
      packageId: PKG_ID,
      runId: RUN_ID,
      userId: USER_ID,
    });
  });

  test("plannedSlotKeys matches planSlots().auto exactly", async () => {
    await post();

    expect(H.inserted[0].plannedSlotKeys).toEqual(PLAN.auto.map((s) => s.key));
    expect(H.inserted[0].styleSpecId).toBe("spec-1");
    expect(H.inserted[0].status).toBe("queued");
  });

  test("an explicit slot list is filtered against the live plan", async () => {
    await post({ slotKeys: ["classroom_cover:0", "classroom_cover:99"] });

    expect(H.inserted[0].plannedSlotKeys).toEqual(["classroom_cover:0"]);
  });

  test("400s when every requested slot is unknown", async () => {
    const res = await post({ slotKeys: ["community_cover:0"] });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("no_slots");
  });

  test("writes an audit entry", async () => {
    await post();

    expect(H.audits.map((a) => a.action)).toContain("images.generate");
  });
});

describe("POST regenerate — single slot", () => {
  test("202s with a one-entry run for a valid slot", async () => {
    const res = await regenerate("classroom_cover", "1", { note: "darker" });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.slotKey).toBe("classroom_cover:1");
    expect(H.inserted[0].plannedSlotKeys).toEqual(["classroom_cover:1"]);
    expect(H.sent[0].data.regenerateNote).toBe("darker");
  });

  test("400 unknown_slot for a kind that is not registered", async () => {
    const res = await regenerate("community_cover", "0");

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("unknown_slot");
  });

  test("400 unknown_slot for an index outside the live plan", async () => {
    const res = await regenerate("classroom_cover", "9");

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("unknown_slot");
    expect(H.sent).toHaveLength(0);
  });

  test("rejects a note over the cap", async () => {
    const res = await regenerate("classroom_cover", "0", {
      note: "x".repeat(1001),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_body");
  });

  test("honours the same already_running guard as a full run", async () => {
    H.runs.push({ id: "other-run", status: "queued" });
    const res = await regenerate("classroom_cover", "0");

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("already_running");
  });

  test("overflow slots are regenerable through the same route", async () => {
    const big = planSlots({
      communityName: "The Calm Closer",
      classroomTitles: Array.from({ length: 10 }, (_, i) => `Module ${i + 1}`),
      calendarTitles: Array.from({ length: 10 }, (_, i) => `Event ${i + 1}`),
    });
    H.source = baseSource({ plan: big });
    const overflowSlot = big.overflow[0];

    const res = await regenerate(
      overflowSlot.kind,
      String(overflowSlot.index),
    );

    expect(res.status).toBe(202);
    expect((await res.json()).slotKey).toBe(overflowSlot.key);
  });
});
