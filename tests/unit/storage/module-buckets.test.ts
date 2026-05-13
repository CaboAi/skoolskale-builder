import { describe, expect, test } from "vitest";
import {
  CREATOR_PHOTOS_BUCKET,
  MODULE_BUCKETS,
  getBucketForModule,
  isImageModule,
  type ImageModuleKey,
} from "@/lib/storage/module-buckets";

describe("MODULE_BUCKETS", () => {
  test("maps every image module to a non-empty bucket name", () => {
    const entries = Object.entries(MODULE_BUCKETS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, bucket] of entries) {
      expect(typeof bucket).toBe("string");
      expect(bucket.length).toBeGreaterThan(0);
    }
  });

  test("maps cover-family modules to the expected buckets", () => {
    expect(MODULE_BUCKETS.cover).toBe("cover-variants");
    expect(MODULE_BUCKETS.icon).toBe("image-variants");
    expect(MODULE_BUCKETS.classroom_cover).toBe("image-variants");
    expect(MODULE_BUCKETS.calendar_cover).toBe("image-variants");
  });

  test("creator-photos bucket constant is the expected value", () => {
    expect(CREATOR_PHOTOS_BUCKET).toBe("creator-photos");
  });
});

describe("isImageModule", () => {
  test.each(["cover", "icon", "classroom_cover", "calendar_cover"] as const)(
    "returns true for image module %s",
    (key) => {
      expect(isImageModule(key)).toBe(true);
    },
  );

  test.each([
    "welcome_dm",
    "transformation",
    "about_us",
    "start_here",
    "classroom",
    "calendar",
    "leaderboard",
    "categories",
    "discovery_seo",
    "definitely-not-a-module",
  ])("returns false for non-image module %s", (key) => {
    expect(isImageModule(key)).toBe(false);
  });

  test("narrows the type to ImageModuleKey for compile-time safety", () => {
    const m: string = "cover";
    if (isImageModule(m)) {
      // Compile-time check — assignment to ImageModuleKey only succeeds when
      // the narrowing worked.
      const narrowed: ImageModuleKey = m;
      expect(MODULE_BUCKETS[narrowed]).toBe("cover-variants");
    }
  });
});

describe("getBucketForModule", () => {
  test("round-trips for every key in MODULE_BUCKETS", () => {
    for (const key of Object.keys(MODULE_BUCKETS) as ImageModuleKey[]) {
      expect(getBucketForModule(key)).toBe(MODULE_BUCKETS[key]);
    }
  });
});
