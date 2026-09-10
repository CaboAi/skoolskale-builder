import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { IMAGE_RENDER_TTL_SECONDS } from "@/lib/storage/signed-url";

/**
 * Batch-sign storage paths for rendering.
 *
 * Ported from the pre-#39 `resolve-variants.ts` for the same reason it
 * existed: the gallery renders up to 25 images, and signing them one at a
 * time is 25 round trips on every poll. `createSignedUrls` takes a list, so
 * this is one call per bucket regardless of image count.
 *
 * A path that fails to sign yields `null` rather than throwing — one broken
 * object must not blank the whole gallery.
 */
export async function signPaths(
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, IMAGE_RENDER_TTL_SECONDS);

  if (error || !data) {
    console.warn(
      `[images/resolve-urls] batch sign failed for ${bucket}: ${error?.message ?? "no data"}`,
    );
    return out;
  }

  for (const entry of data) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}
