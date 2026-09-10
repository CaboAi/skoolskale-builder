/**
 * Integration tests for GET /api/packages/[id]/modules/[module]/prompt.
 *
 * The route delegates to @/lib/prompts/dispatch:buildPromptFor(); these
 * tests assert the validation surface + the dispatch wiring (called with
 * the right args, response wraps the returned string).
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

const { requireUserMock, buildPromptForMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(async () => ({ id: USER_ID, email: "t@e.com" })),
  buildPromptForMock: vi.fn(
    async () => "MOCKED PROMPT BODY for the requested module.",
  ),
}));

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/prompts/dispatch", () => ({
  buildPromptFor: buildPromptForMock,
}));

// Static import — see regenerate.test.ts for rationale.
import { GET } from "@/app/api/packages/[id]/modules/[module]/prompt/route";

function getRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: USER_ID, email: "t@e.com" });
  buildPromptForMock.mockResolvedValue(
    "MOCKED PROMPT BODY for the requested module.",
  );
});

describe("GET /api/packages/[id]/modules/[module]/prompt", () => {
  test("happy path returns { prompt: string }", async () => {
    const res = await GET(
      getRequest(`http://test/api/packages/${PKG_ID}/modules/welcome_dm/prompt`),
      { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { prompt: string };
    expect(body.prompt).toBe(
      "MOCKED PROMPT BODY for the requested module.",
    );
    expect(buildPromptForMock).toHaveBeenCalledWith({
      packageId: PKG_ID,
      userId: USER_ID,
      module: "welcome_dm",
      regenerateNote: undefined,
    });
  });

  test("threads ?note= through to the dispatch", async () => {
    const res = await GET(
      getRequest(
        `http://test/api/packages/${PKG_ID}/modules/about_us/prompt?note=less%20abstract`,
      ),
      { params: Promise.resolve({ id: PKG_ID, module: "about_us" }) },
    );
    expect(res.status).toBe(200);
    expect(buildPromptForMock).toHaveBeenCalledWith({
      packageId: PKG_ID,
      userId: USER_ID,
      module: "about_us",
      regenerateNote: "less abstract",
    });
  });

  test("rejects unknown module with 400 invalid_module", async () => {
    const res = await GET(
      getRequest(`http://test/api/packages/${PKG_ID}/modules/nope/prompt`),
      { params: Promise.resolve({ id: PKG_ID, module: "nope" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_module");
    expect(buildPromptForMock).not.toHaveBeenCalled();
  });

  test("rejects invalid uuid with 400 invalid_id", async () => {
    const res = await GET(
      getRequest(`http://test/api/packages/not-a-uuid/modules/welcome_dm/prompt`),
      {
        params: Promise.resolve({ id: "not-a-uuid", module: "welcome_dm" }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_id");
  });

  test("rejects oversized note with 400 invalid_note", async () => {
    const note = encodeURIComponent("x".repeat(1001));
    const res = await GET(
      getRequest(
        `http://test/api/packages/${PKG_ID}/modules/welcome_dm/prompt?note=${note}`,
      ),
      { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_note");
    expect(buildPromptForMock).not.toHaveBeenCalled();
  });

  test("returns 404 when dispatch reports the package wasn't found", async () => {
    buildPromptForMock.mockRejectedValueOnce(
      new Error(`launch_package ${PKG_ID} not found`),
    );
    const res = await GET(
      getRequest(`http://test/api/packages/${PKG_ID}/modules/welcome_dm/prompt`),
      { params: Promise.resolve({ id: PKG_ID, module: "welcome_dm" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("not_found");
  });
});
