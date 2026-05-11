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

const { logAuditMock, requireUserMock, inngestSendMock, dbSelectLimitMock } =
  vi.hoisted(() => ({
    logAuditMock: vi.fn(async () => undefined),
    requireUserMock: vi.fn(async () => ({ id: USER_ID, email: "t@e.com" })),
    inngestSendMock: vi.fn(async () => ({ ids: ["evt-1"] })),
    dbSelectLimitMock: vi.fn(async () => [{ id: PKG_ID }]),
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

const route = () =>
  import("@/app/api/packages/[id]/modules/[module]/regenerate/route");

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
      const { POST } = await route();
      const res = await POST(
        jsonRequest(`http://test/regen`, "POST", {
          editedPrompt: "x".repeat(10000),
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      expect(res.status).toBe(202);
    });

    test("rejects editedPrompt over 10000 chars with 400", async () => {
      const { POST } = await route();
      const res = await POST(
        jsonRequest(`http://test/regen`, "POST", {
          editedPrompt: "x".repeat(10001),
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      expect(res.status).toBe(400);
    });

    test("accepts both note and editedPrompt in the same request", async () => {
      const { POST } = await route();
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
      const { POST } = await route();
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
      const { POST } = await route();
      await POST(
        jsonRequest(`http://test/regen`, "POST", { note: "softer please" }),
        { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
      );
      const call = inngestSendMock.mock.calls[0][0];
      expect(call.data.editedPrompt).toBeUndefined();
      expect(call.data.regenerateNote).toBe("softer please");
    });

    test("works on an image module (cover) too", async () => {
      const { POST } = await route();
      await POST(
        jsonRequest(`http://test/regen`, "POST", {
          editedPrompt: "A serene mountain at dawn.",
        }),
        { params: Promise.resolve({ id: PKG_ID, module: "cover" }) },
      );
      const call = inngestSendMock.mock.calls[0][0];
      expect(call.name).toBe("generate.cover.requested");
      expect(call.data.editedPrompt).toBe("A serene mountain at dawn.");
    });
  });

  describe("audit log", () => {
    test("records editedPrompt presence as boolean (not full content)", async () => {
      const { POST } = await route();
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
      const { POST } = await route();
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
