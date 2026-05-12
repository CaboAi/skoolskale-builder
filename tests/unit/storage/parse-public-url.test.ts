import { describe, expect, test } from "vitest";
import { parsePublicStorageUrl } from "@/lib/storage/parse-public-url";

describe("parsePublicStorageUrl", () => {
  test("parses a cover-variants URL", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/public/cover-variants/abc-uuid/variant-1.png",
      ),
    ).toEqual({ bucket: "cover-variants", path: "abc-uuid/variant-1.png" });
  });

  test("parses an image-variants URL with a sub-folder (icon)", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/public/image-variants/pkg-uuid/icon/variant-2.png",
      ),
    ).toEqual({
      bucket: "image-variants",
      path: "pkg-uuid/icon/variant-2.png",
    });
  });

  test("parses a creator-photos URL", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/public/creator-photos/user-id/headshot.jpg",
      ),
    ).toEqual({
      bucket: "creator-photos",
      path: "user-id/headshot.jpg",
    });
  });

  test("decodes percent-encoded path segments", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/public/creator-photos/user/space%20name.png",
      ),
    ).toEqual({
      bucket: "creator-photos",
      path: "user/space name.png",
    });
  });

  test("returns null for a signed URL", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/sign/cover-variants/pkg/variant-1.png?token=abc",
      ),
    ).toBeNull();
  });

  test("returns null for a non-URL string", () => {
    expect(parsePublicStorageUrl("not a url")).toBeNull();
  });

  test("returns null for an empty string", () => {
    expect(parsePublicStorageUrl("")).toBeNull();
  });

  test("returns null for an unrelated URL", () => {
    expect(parsePublicStorageUrl("https://example.com/some/path.png")).toBeNull();
  });

  test("returns null when the bucket segment is missing", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/public/",
      ),
    ).toBeNull();
  });

  test("returns null when the path segment is missing", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/public/cover-variants/",
      ),
    ).toBeNull();
  });

  test("returns null for malformed percent-encoding", () => {
    expect(
      parsePublicStorageUrl(
        "https://proj.supabase.co/storage/v1/object/public/creator-photos/user/%E0%A4%A.png",
      ),
    ).toBeNull();
  });
});
