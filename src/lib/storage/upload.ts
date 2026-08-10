import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Upload a binary object to a Supabase Storage bucket.
 *
 * Uses the service-role client (same trust model as signed-url.ts): callers
 * are expected to have enforced auth before invoking. `upsert: true` makes
 * retried Inngest steps idempotent — a re-render overwrites the same path
 * instead of failing on conflict.
 *
 * Returns the bucket-relative path so callers can persist it verbatim for
 * later signing.
 */
export async function uploadStorageObject(
  bucket: string,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) {
    throw new Error(`upload failed for ${bucket}/${path}: ${error.message}`);
  }
  return path;
}
