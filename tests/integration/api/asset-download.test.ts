/**
 * Validation surface tests for the download-redirect route.
 *
 * Covers the full Q5 error matrix from the Stage 3 plan:
 *  - 400 on invalid uuid, unknown module, non-integer index
 *  - 404 on package missing, asset missing, variant index out of range,
 *    missing storagePath
 *  - happy path: 302 to the signed URL with Cache-Control: no-store and
 *    `?download=<filename>` driven by the creator's communityName
 *
 * Auth and storage signing are mocked. The route itself remains the unit
 * under test.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";

const { requireUserMock, getRawMock, createSignedStorageUrlMock } = vi.hoisted(
  () => ({
    requireUserMock: vi.fn(async () => ({
      id: "00000000-0000-0000-0000-000000000001",
      email: "t@e.com",
    })),
    getRawMock: vi.fn(),
    createSignedStorageUrlMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/db/packages", () => ({
  getPackageWithDetailsRaw: getRawMock,
}));

// Don't use importActual — the real module imports @/lib/supabase/server
// which forces server env validation at load time and fails when the test
// env lacks an ANTHROPIC_API_KEY. Re-export the TTL constants manually.
vi.mock("@/lib/storage/signed-url", () => ({
  createSignedStorageUrl: createSignedStorageUrlMock,
  IMAGE_RENDER_TTL_SECONDS: 3600,
  DOWNLOAD_REDIRECT_TTL_SECONDS: 60,
}));

vi.mock("@/lib/db", () => ({ db: {} }));

import { GET } from "@/app/api/packages/[id]/assets/[module]/[index]/download/route";

type Variant = {
  url?: string;
  storagePath?: string;
  index: number;
};

function asset(
  id: string,
  module: string,
  variants: Variant[],
  createdAt = new Date("2026-05-01T00:00:00Z"),
) {
  return {
    id,
    packageId: PKG_ID,
    module,
    version: 1,
    content: { variants },
    approved: true,
    approvedBy: null,
    approvedAt: null,
    editHistory: [],
    vaNotes: null,
    qualityScore: null,
    createdBy: "00000000-0000-0000-0000-000000000099",
    createdAt,
  };
}

function call(id: string, module: string, index: string) {
  const req = new NextRequest(
    `http://test/api/packages/${id}/assets/${module}/${index}/download`,
    { method: "GET" },
  );
  return GET(req, {
    params: Promise.resolve({ id, module, index }),
  });
}

beforeEach(() => {
  requireUserMock.mockClear();
  getRawMock.mockReset();
  createSignedStorageUrlMock.mockReset();
});

describe("GET /api/packages/[id]/assets/[module]/[index]/download", () => {
  test("400 — invalid package id (not a uuid)", async () => {
    const res = await call("not-a-uuid", "cover", "0");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_id");
  });

  test("400 — module not in image registry", async () => {
    const res = await call(PKG_ID, "welcome_dm", "0");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_module");
  });

  test("400 — module not a real module name", async () => {
    const res = await call(PKG_ID, "totally-fake", "0");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_module");
  });

  test("400 — index is not a non-negative integer", async () => {
    const res = await call(PKG_ID, "cover", "-1");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_index");
  });

  test("400 — index is not a number at all", async () => {
    const res = await call(PKG_ID, "cover", "abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_index");
  });

  test("404 — package not found", async () => {
    getRawMock.mockResolvedValue(null);
    const res = await call(PKG_ID, "cover", "0");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("not_found");
  });

  test("404 — package exists but no asset for module", async () => {
    getRawMock.mockResolvedValue({
      package: { id: PKG_ID },
      creator: { communityName: "Some Community" },
      assets: [asset("a1", "welcome_dm", [])],
    });
    const res = await call(PKG_ID, "cover", "0");
    expect(res.status).toBe(404);
  });

  test("404 — variant index out of range", async () => {
    getRawMock.mockResolvedValue({
      package: { id: PKG_ID },
      creator: { communityName: "Cabo Wellness" },
      assets: [
        asset("a1", "cover", [
          { url: "u", storagePath: "pkg/v0.png", index: 0 },
        ]),
      ],
    });
    const res = await call(PKG_ID, "cover", "5");
    expect(res.status).toBe(404);
  });

  test("404 — variant has no storagePath", async () => {
    getRawMock.mockResolvedValue({
      package: { id: PKG_ID },
      creator: { communityName: "Cabo Wellness" },
      assets: [
        asset("a1", "cover", [
          // Legacy row, missing storagePath entirely.
          { url: "u", index: 0 },
        ]),
      ],
    });
    const res = await call(PKG_ID, "cover", "0");
    expect(res.status).toBe(404);
  });

  test("happy path — 302 to signed URL with no-store + sanitized filename", async () => {
    getRawMock.mockResolvedValue({
      package: { id: PKG_ID },
      creator: { communityName: "Cabo & Wellness!! 2026" },
      assets: [
        asset("a1", "cover", [
          { url: "ignored-public", storagePath: "pkg/variant-1.png", index: 0 },
          { url: "ignored-public", storagePath: "pkg/variant-2.png", index: 1 },
        ]),
      ],
    });
    createSignedStorageUrlMock.mockResolvedValue(
      "https://proj.supabase.co/storage/v1/object/sign/cover-variants/pkg/variant-1.png?token=abc&download=cabo-wellness-2026-cover-1.png",
    );

    const res = await call(PKG_ID, "cover", "0");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://proj.supabase.co/storage/v1/object/sign/cover-variants/pkg/variant-1.png?token=abc&download=cabo-wellness-2026-cover-1.png",
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(createSignedStorageUrlMock).toHaveBeenCalledWith(
      "cover-variants",
      "pkg/variant-1.png",
      60,
      { download: "cabo-wellness-2026-cover-1.png" },
    );
  });

  test("happy path — picks the LATEST asset row when there are multiple", async () => {
    getRawMock.mockResolvedValue({
      package: { id: PKG_ID },
      creator: { communityName: "Pueblo Bonito" },
      assets: [
        // Older row first to confirm the route doesn't just take [0].
        asset(
          "older",
          "cover",
          [{ url: "u", storagePath: "pkg/old.png", index: 0 }],
          new Date("2026-05-01T00:00:00Z"),
        ),
        asset(
          "newer",
          "cover",
          [{ url: "u", storagePath: "pkg/new.png", index: 0 }],
          new Date("2026-05-08T00:00:00Z"),
        ),
      ],
    });
    createSignedStorageUrlMock.mockResolvedValue(
      "https://signed.example/sign/pkg/new.png?token=t",
    );

    const res = await call(PKG_ID, "cover", "0");
    expect(res.status).toBe(302);
    expect(createSignedStorageUrlMock).toHaveBeenCalledWith(
      "cover-variants",
      "pkg/new.png",
      60,
      { download: "pueblo-bonito-cover-1.png" },
    );
  });

  test("image-variants modules (icon, classroom_cover, calendar_cover) route to the image-variants bucket", async () => {
    getRawMock.mockResolvedValue({
      package: { id: PKG_ID },
      creator: { communityName: "Test" },
      assets: [
        asset("a1", "icon", [
          { url: "u", storagePath: "pkg/icon/v1.png", index: 0 },
        ]),
      ],
    });
    createSignedStorageUrlMock.mockResolvedValue("https://signed.example/x");

    await call(PKG_ID, "icon", "0");

    expect(createSignedStorageUrlMock).toHaveBeenCalledWith(
      "image-variants",
      "pkg/icon/v1.png",
      60,
      { download: "test-icon-1.png" },
    );
  });
});
