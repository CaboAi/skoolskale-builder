/**
 * Integration tests for POST /api/packages/[id]/modules/[module]/regenerate.
 *
 * Phase 2 added an optional `editedPrompt` body field that bypasses the
 * builder when emitted into the Inngest event payload. These tests cover:
 *   - validation: editedPrompt up to 10000 chars accepted, longer rejected
 *   - emit: when editedPrompt is set, the inngest.send payload carries it
 *   - emit: when editedPrompt is absent, payload still works (no regression)
 *   - audit: editedPrompt presence is captured as a boolean (not stored in
 *     full — VAs may put sensitive specifics there and the audit log is
 *     queryable)
 *
 * Pattern follows tests/integration/api/select-variant.test.ts: vi.hoisted
 * spies for cross-import stability under parallel-suite execution; minimal
 * stateless mocks where possible.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

// Spy arg types are explicit so mock.calls[N][M] resolves to the arg
// (rather than `undefined` from zero-arg inference).
const { logAuditMock, requireUserMock, inngestSendMock, dbSelectLimitMock } =
  vi.hoisted(() => ({
    logAuditMock: vi.fn<
      (
        userId: string,
        action: string,
        entityType: string,
        entityId: string,
        payload: unknown,
      ) => Promise<void>
    >(async () => undefined),
    requireUserMock: vi.fn<() => Promise<{ id: string; email: string }>>(
      async () => ({
        id: "00000000-0000-0000-0000-000000000001",
        email: "t@e.com",
      }),
    ),
    inngestSendMock: vi.fn<
      (event: {
        name: string;
        data: Record<string, unknown>;
      }) => Promise<{ ids: string[] }>
    >(async () => ({ ids: ["evt-1"] })),
    dbSelectLimitMock: vi.fn<() => Promise<{ id: string }[]>>(async () => [
      { id: "00000000-0000-4000-8000-0000000000aa" },
    ]),
  }));

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: inngestSendMock },
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: dbSelectLimitMock,
        }),
      }),
    }),
  },
}));

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

// Static import — vitest hoists vi.mock above this line via AST
// transformation, so the route sees the mocked deps. Cold-load happens
// once at file boot (governed by hookTimeout, default 10s) instead of
// once per test against the 5s testTimeout — eliminates the
// "first test in file timeout" flake under parallel-suite contention.
import { POST } from "@/app/api/packages/[id]/modules/[module]/regenerate/route";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default returns the spies need each test.
  requireUserMock.mockResolvedValue({ id: USER_ID, email: "t@e.com" });
  dbSelectLimitMock.mockResolvedValue([{ id: PKG_ID }]);
  inngestSendMock.mockResolvedValue({ ids: ["evt-1"] });
});

describe("POST /api/packages/[id]/modules/[module]/regenerate", () => {
  describe("validation", () => {
    test("accepts editedPrompt up to 10000 chars", async () => {
      const res = await POST(
        jsonRequest(`http://test/regen`, "POST", {
          editedPrompt: "x".repeat(10000),
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      expect(res.status).toBe(202);
    });

    test("rejects editedPrompt over 10000 chars with 400", async () => {
      const res = await POST(
        jsonRequest(`http://test/regen`, "POST", {
          editedPrompt: "x".repeat(10001),
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      expect(res.status).toBe(400);
    });

    test("accepts both note and editedPrompt in the same request", async () => {
      const res = await POST(
        jsonRequest(`http://test/regen`, "POST", {
          note: "be concise",
          editedPrompt: "Write a haiku.",
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      expect(res.status).toBe(202);
    });
  });

  describe("event payload", () => {
    test("emits editedPrompt into Inngest event data when set", async () => {
      await POST(
        jsonRequest(`http://test/regen`, "POST", {
          editedPrompt: "Write exactly one sentence with no emoji.",
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      expect(inngestSendMock).toHaveBeenCalledTimes(1);
      const call = inngestSendMock.mock.calls[0][0];
      expect(call).toMatchObject({
        name: "generate.welcome_dm.requested",
        data: {
          packageId: PKG_ID,
          userId: USER_ID,
          editedPrompt: "Write exactly one sentence with no emoji.",
        },
      });
    });

    test("does NOT include editedPrompt key when absent (no regression)", async () => {
      await POST(
        jsonRequest(`http://test/regen`, "POST", { note: "softer please" }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      const call = inngestSendMock.mock.calls[0][0];
      expect(call.data.editedPrompt).toBeUndefined();
      expect(call.data.regenerateNote).toBe("softer please");
    });

    // The "works on an image module (cover) too" case was removed alongside
    // the cover module itself in chore/remove-image-generation. The
    // text-module coverage above exercises the same editedPrompt event-
    // shape contract.
  });

  describe("audit log", () => {
    test("records editedPrompt presence as boolean (not full content)", async () => {
      await POST(
        jsonRequest(`http://test/regen`, "POST", {
          editedPrompt: "Sensitive contents the VA typed in.",
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      expect(logAuditMock).toHaveBeenCalledTimes(1);
      const args = logAuditMock.mock.calls[0];
      expect(args[1]).toBe("module.regenerate.welcome_dm");
      // 5th arg is the audit payload
      const payload = args[4] as { editedPrompt?: boolean };
      expect(payload.editedPrompt).toBe(true);
    });

    test("omits editedPrompt key from audit when absent", async () => {
      await POST(
        jsonRequest(`http://test/regen`, "POST", { note: "x" }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      const args = logAuditMock.mock.calls[0];
      const payload = args[4] as { editedPrompt?: boolean };
      expect(payload.editedPrompt).toBeUndefined();
    });
  });
});
