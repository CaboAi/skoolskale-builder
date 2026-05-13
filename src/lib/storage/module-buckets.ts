/**
 * Module → Supabase Storage bucket mapping.
 *
 * Single source of truth for the four image-generation modules. Used by the
 * signed-URL resolver, the download-redirect route, and any future code that
 * needs to convert a `(module, path)` pair into a bucket-scoped operation.
 *
 * Constants match the bucket names provisioned in `scripts/setup-storage.ts`:
 *   - cover-variants   → community cover (1456×816, 3 variants)
 *   - image-variants   → icon (3 variants), classroom_cover (1), calendar_cover (1)
 *   - creator-photos   → VA-uploaded creator portrait (Gemini reference image)
 *
 * Pure module — no `server-only` import so this can also be referenced from
 * client components if needed for href construction.
 */
export const MODULE_BUCKETS = {
  cover: "cover-variants",
  icon: "image-variants",
  classroom_cover: "image-variants",
  calendar_cover: "image-variants",
} as const;

export type ImageModuleKey = keyof typeof MODULE_BUCKETS;

export const CREATOR_PHOTOS_BUCKET = "creator-photos";

export function isImageModule(module: string): module is ImageModuleKey {
  return module in MODULE_BUCKETS;
}

export function getBucketForModule(module: ImageModuleKey): string {
  return MODULE_BUCKETS[module];
}
