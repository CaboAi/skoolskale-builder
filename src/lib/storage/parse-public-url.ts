import "server-only";

/**
 * Supabase public storage URLs follow the shape:
 *   https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * Extract the bucket name + object path. Returns null when the URL doesn't
 * match — caller decides whether that's a hard error or a skip.
 *
 * Signed URLs (which use /storage/v1/object/sign/) are intentionally NOT
 * parsed by this helper — the backfill script only consumes public URLs
 * persisted before the signed-urls migration. A row already on /sign/
 * means it was created post-migration or was hand-edited; either way it
 * isn't safe to extract a stable path from.
 */
export function parsePublicStorageUrl(
  url: string,
): { bucket: string; path: string } | null {
  if (typeof url !== "string" || url.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Match exactly `/storage/v1/object/public/<bucket>/<path>`; reject anything
  // else (sign URLs, root paths, missing bucket segment, etc.).
  const match = parsed.pathname.match(
    /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
  );
  if (!match) return null;
  const [, bucket, path] = match;
  // The path segment may contain URL-encoded characters (e.g. spaces).
  // Supabase's storage SDK expects decoded paths.
  try {
    return { bucket, path: decodeURIComponent(path) };
  } catch {
    // Malformed percent-encoding — treat as parse failure.
    return null;
  }
}
