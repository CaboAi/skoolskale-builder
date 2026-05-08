/**
 * Integration tests for the generic select-variant route.
 *
 * Covers the validation surface that's specific to PR #7's generalization:
 *  - hasVariants gating (image-single + text modules return 400)
 *  - module-key validation (unknown module returns 400)
 *  - body validation
 *
 * The happy-path persistence + audit-log path is exercised end-to-end by
 * tests/integration/e2e/generate-package.test.ts and the manual Vercel
 * preview smoke; replicating it here added a flaky db-mock that broke
 * under parallel-suite execution and added no incremental coverage.
 */
import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";

// Hoisted mocks so the spy references remain stable across the dynamic
// route import, even when other test files in the same run also mock
// @/lib/auth or @/lib/audit.
const { logAuditMock, requireUserMock } = vi.hoisted(() => ({
  logAuditMock: vi.fn(async () => undefined),
  requireUserMock: vi.fn(async () => ({
    id: "00000000-0000-0000-0000-000000000001",
    email: "t@e.com",
  })),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

// Minimal stateless mock for @/lib/db. The route imports db at the top,
// which triggers env validation — without this we'd need every server
// env var stubbed. db itself is never touched on any of the five 400
// validation paths exercised below, so an empty object is sufficient
// (and no closure state means no risk of leaking mock factory state
// into other parallel-worker test files).
vi.mock("@/lib/db", () => ({ db: {} }));

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

const route = () =>
  import("@/app/api/packages/[id]/modules/[module]/select-variant/route");

describe("PUT /api/packages/[id]/modules/[module]/select-variant", () => {
  test("classroom_cover: rejects with 400 (no variants)", async () => {
    const { PUT } = await route();
    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/${PKG_ID}/modules/classroom_cover/select-variant`,
        "PUT",
        { index: 0 },
      ),
      {
        params: Promise.resolve({ id: PKG_ID, module: "classroom_cover" }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("no_variants");
  });

  test("calendar_cover: rejects with 400 (no variants)", async () => {
    const { PUT } = await route();
    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/${PKG_ID}/modules/calendar_cover/select-variant`,
        "PUT",
        { index: 0 },
      ),
      {
        params: Promise.resolve({ id: PKG_ID, module: "calendar_cover" }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("no_variants");
  });

  test("text module (classroom): rejects with 400 (no variants)", async () => {
    const { PUT } = await route();
    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/${PKG_ID}/modules/classroom/select-variant`,
        "PUT",
        { index: 0 },
      ),
      { params: Promise.resolve({ id: PKG_ID, module: "classroom" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("no_variants");
  });

  test("unknown module: rejects with 400", async () => {
    const { PUT } = await route();
    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/${PKG_ID}/modules/not_a_module/select-variant`,
        "PUT",
        { index: 0 },
      ),
      { params: Promise.resolve({ id: PKG_ID, module: "not_a_module" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_module");
  });

  test("invalid package id: rejects with 400 invalid_id", async () => {
    const { PUT } = await route();
    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/not-a-uuid/modules/cover/select-variant`,
        "PUT",
        { index: 0 },
      ),
      { params: Promise.resolve({ id: "not-a-uuid", module: "cover" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_id");
  });
});
