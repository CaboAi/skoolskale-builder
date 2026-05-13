import { describe, expect, test, vi, beforeEach } from "vitest";

const { createSignedUrlMock } = vi.hoisted(() => ({
  createSignedUrlMock: vi.fn<
    (
      path: string,
      ttl: number,
    ) => Promise<{
      data: { signedUrl: string } | null;
      error: { message: string } | null;
    }>
  >(),
}));

const fromMock = vi.fn(() => ({
  createSignedUrl: createSignedUrlMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    storage: { from: fromMock },
  }),
}));

import {
  createSignedStorageUrl,
  DOWNLOAD_REDIRECT_TTL_SECONDS,
  IMAGE_RENDER_TTL_SECONDS,
} from "@/lib/storage/signed-url";

beforeEach(() => {
  createSignedUrlMock.mockReset();
  fromMock.mockClear();
});

describe("TTL constants", () => {
  test("IMAGE_RENDER_TTL_SECONDS is 1 hour", () => {
    expect(IMAGE_RENDER_TTL_SECONDS).toBe(3600);
  });

  test("DOWNLOAD_REDIRECT_TTL_SECONDS is 60 seconds", () => {
    expect(DOWNLOAD_REDIRECT_TTL_SECONDS).toBe(60);
  });
});

describe("createSignedStorageUrl", () => {
  test("returns the signedUrl on happy path and forwards bucket, path, ttl", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://proj.supabase.co/storage/v1/object/sign/cover-variants/pkg/variant-0.png?token=abc" },
      error: null,
    });

    const result = await createSignedStorageUrl(
      "cover-variants",
      "pkg/variant-0.png",
      3600,
    );

    expect(result).toBe(
      "https://proj.supabase.co/storage/v1/object/sign/cover-variants/pkg/variant-0.png?token=abc",
    );
    expect(fromMock).toHaveBeenCalledWith("cover-variants");
    expect(createSignedUrlMock).toHaveBeenCalledWith("pkg/variant-0.png", 3600);
  });

  test("forwards a short TTL (60s download window) unchanged", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://proj.supabase.co/storage/v1/object/sign/image-variants/pkg/icon/variant-1.png?token=xyz" },
      error: null,
    });

    await createSignedStorageUrl(
      "image-variants",
      "pkg/icon/variant-1.png",
      DOWNLOAD_REDIRECT_TTL_SECONDS,
    );

    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "pkg/icon/variant-1.png",
      60,
    );
  });

  test("throws when Supabase returns an error", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: "object not found" },
    });

    await expect(
      createSignedStorageUrl("cover-variants", "pkg/variant-0.png", 3600),
    ).rejects.toThrow(
      "signed URL generation failed for cover-variants/pkg/variant-0.png: object not found",
    );
  });

  test("throws when Supabase returns no signedUrl despite no error", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "" },
      error: null,
    });

    await expect(
      createSignedStorageUrl("cover-variants", "pkg/variant-0.png", 3600),
    ).rejects.toThrow(
      "signed URL generation returned no URL for cover-variants/pkg/variant-0.png",
    );
  });

  test("throws when Supabase returns null data and null error", async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: null });

    await expect(
      createSignedStorageUrl("cover-variants", "pkg/variant-0.png", 3600),
    ).rejects.toThrow(
      "signed URL generation returned no URL for cover-variants/pkg/variant-0.png",
    );
  });
});
