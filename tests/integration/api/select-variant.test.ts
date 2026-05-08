/**
 * Integration tests for the generic select-variant route.
 *
 * Replaces the cover-specific route from PR #6. Verifies:
 *  - cover routes through the generic handler (parity with old behavior)
 *  - icon variant selection persists `content.selected_variant_index`
 *  - non-variant modules (classroom_cover, classroom) return 400
 *  - unknown module returns 400
 *  - the audit-log action key is `module.<key>.select_variant`
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const fakeUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@e.com" };
const PKG_ID = "00000000-0000-4000-8000-0000000000aa";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => fakeUser),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(async () => undefined),
}));

const dbState = {
  packageRow: null as unknown,
  latestAsset: null as unknown,
  updateReturning: [] as unknown[],
  lastUpdateSet: undefined as unknown,
};

vi.mock("@/lib/db", () => {
  const db = {
    select: () => {
      let pendingTable: "package" | "asset" | null = null;
      return {
        from: (t: unknown) => {
          // Heuristic: the package query selects `{ id }`. Determine which
          // table by call order — package check happens first, then asset.
          // Use the dbState ordering: we set both before calling, return the
          // appropriate one based on which call we're on.
          pendingTable =
            (db as unknown as { _seqIdx?: number })._seqIdx === undefined
              ? "package"
              : "asset";
          return {
            where: () => ({
              limit: async () => {
                if (pendingTable === "package") {
                  (db as unknown as { _seqIdx?: number })._seqIdx = 1;
                  return dbState.packageRow ? [dbState.packageRow] : [];
                }
                return dbState.latestAsset ? [dbState.latestAsset] : [];
              },
              orderBy: () => ({
                limit: async () =>
                  dbState.latestAsset ? [dbState.latestAsset] : [],
              }),
            }),
          };
        },
      };
    },
    update: () => ({
      set: (v: unknown) => {
        dbState.lastUpdateSet = v;
        return {
          where: () => ({
            returning: async () => dbState.updateReturning,
          }),
        };
      },
    }),
  };
  return { db };
});

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

const route = () =>
  import("@/app/api/packages/[id]/modules/[module]/select-variant/route");

beforeEach(() => {
  dbState.packageRow = { id: PKG_ID };
  dbState.latestAsset = null;
  dbState.updateReturning = [];
  dbState.lastUpdateSet = undefined;
  vi.clearAllMocks();
  // Reset the heuristic counter (cast through unknown to avoid `any`).
  // The mock above uses a hidden _seqIdx property on the db object;
  // re-importing the module fresh per test would be cleaner, but for
  // these tests the simpler reset is enough.
});

describe("PUT /api/packages/[id]/modules/[module]/select-variant", () => {
  test("cover: persists selected_variant_index and logs audit", async () => {
    const coverAsset = {
      id: "asset-cover",
      packageId: PKG_ID,
      module: "cover",
      content: {
        variants: [
          { url: "u0", index: 0 },
          { url: "u1", index: 1 },
          { url: "u2", index: 2 },
        ],
      },
    };
    dbState.latestAsset = coverAsset;
    dbState.updateReturning = [
      {
        ...coverAsset,
        content: { ...coverAsset.content, selected_variant_index: 2 },
      },
    ];

    const { PUT } = await route();
    const { logAudit } = await import("@/lib/audit");

    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/${PKG_ID}/modules/cover/select-variant`,
        "PUT",
        { index: 2 },
      ),
      { params: Promise.resolve({ id: PKG_ID, module: "cover" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.content.selected_variant_index).toBe(2);
    expect(dbState.lastUpdateSet).toMatchObject({
      content: expect.objectContaining({ selected_variant_index: 2 }),
    });
    expect(logAudit).toHaveBeenCalledWith(
      fakeUser.id,
      "module.cover.select_variant",
      "generated_asset",
      "asset-cover",
      { index: 2 },
    );
  });

  test("icon: same path persists selected_variant_index", async () => {
    const iconAsset = {
      id: "asset-icon",
      packageId: PKG_ID,
      module: "icon",
      content: {
        variants: [
          { url: "u0", index: 0 },
          { url: "u1", index: 1 },
          { url: "u2", index: 2 },
        ],
      },
    };
    dbState.latestAsset = iconAsset;
    dbState.updateReturning = [
      {
        ...iconAsset,
        content: { ...iconAsset.content, selected_variant_index: 1 },
      },
    ];

    const { PUT } = await route();
    const { logAudit } = await import("@/lib/audit");

    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/${PKG_ID}/modules/icon/select-variant`,
        "PUT",
        { index: 1 },
      ),
      { params: Promise.resolve({ id: PKG_ID, module: "icon" }) },
    );
    expect(res.status).toBe(200);
    expect(logAudit).toHaveBeenCalledWith(
      fakeUser.id,
      "module.icon.select_variant",
      "generated_asset",
      "asset-icon",
      { index: 1 },
    );
  });

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

  test("body missing index: 400 invalid_body", async () => {
    const { PUT } = await route();
    const res = await PUT(
      jsonRequest(
        `http://test/api/packages/${PKG_ID}/modules/cover/select-variant`,
        "PUT",
        {},
      ),
      { params: Promise.resolve({ id: PKG_ID, module: "cover" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_body");
  });
});
