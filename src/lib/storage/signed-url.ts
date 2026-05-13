import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Default TTL for signed image URLs embedded in server-rendered pages
 * (dashboard, export view, module cards). One hour is a generous safety
 * margin: VAs work in minutes-per-page, and a refresh re-signs.
 *
 * See memory/signed-urls-migration.md §1 for the full rationale.
 */
export const IMAGE_RENDER_TTL_SECONDS = 3600;

/**
 * Short TTL for the download-redirect route. Each click hits an internal
 * route that re-signs on demand and 302s to the signed URL — 60s is plenty
 * for the browser to follow the redirect and start the download, and short
 * enough that a token captured from the wire is useless seconds later.
 */
export const DOWNLOAD_REDIRECT_TTL_SECONDS = 60;

/**
 * Generate a Supabase Storage signed URL for a private object.
 *
 * Uses the service-role client so signing succeeds regardless of bucket
 * visibility or RLS — callers are expected to have already enforced auth
 * (e.g. requireUser()) before invoking this helper.
 *
 * Throws on Supabase error OR on a successful response that lacks a
 * signedUrl, so callers can assume the returned string is non-empty.
 */
export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  ttlSeconds: number,
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);
  if (error) {
    throw new Error(
      `signed URL generation failed for ${bucket}/${path}: ${error.message}`,
    );
  }
  if (!data?.signedUrl) {
    throw new Error(
      `signed URL generation returned no URL for ${bucket}/${path}`,
    );
  }
  return data.signedUrl;
}
