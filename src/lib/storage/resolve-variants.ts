import "server-only";
import type { GeneratedAsset } from "@/lib/db/schema";
import { createServiceClient } from "@/lib/supabase/server";
import { IMAGE_RENDER_TTL_SECONDS } from "@/lib/storage/signed-url";
import {
  MODULE_BUCKETS,
  isImageModule,
  type ImageModuleKey,
} from "@/lib/storage/module-buckets";

/**
 * Shape of an image-module variant inside `generated_assets.content`.
 * Stages 1+2 ensure every row has both `url` (legacy public) and
 * `storagePath` populated. Stage 3 rewrites `url` to a fresh signed URL
 * on every read; Stage 4 makes `url` purely ephemeral.
 */
type VariantWithPath = {
  url?: string | null;
  storagePath?: string | null;
  index: number;
  [k: string]: unknown;
};

type ImageContent = {
  variants: VariantWithPath[];
  selected_variant_index?: number;
  [k: string]: unknown;
};

/**
 * Replace every image-module variant's `url` field with a fresh signed URL
 * resolved from its `storagePath`. Returns a defensive deep-ish copy — the
 * input assets array is not mutated.
 *
 * Batches `createSignedUrls(paths, ttl)` per bucket: at most one Supabase
 * round trip per distinct bucket, run in parallel. A 4-module package thus
 * costs 2 round trips total (cover-variants + image-variants).
 *
 * Fallback policy: if a variant has `url` but no `storagePath` (shouldn't
 * happen after the Stage 1 backfill, but defensive), we log a warning and
 * keep the existing public URL value untouched. After Stage 4 ships and
 * the public-URL fallback is removed, missing storagePath becomes a hard
 * error in a follow-up PR.
 */
export async function resolveAssetUrls(
  assets: GeneratedAsset[],
): Promise<GeneratedAsset[]> {
  type Target = {
    assetIdx: number;
    variantIdx: number;
    path: string;
    bucket: string;
  };
  const targets: Target[] = [];
  const fallbacks: { assetId: string; module: string; variantIdx: number }[] =
    [];

  // Pass 1: walk assets, collect (bucket, path) pairs to sign + log fallbacks.
  // We do NOT mutate yet — that happens in pass 3 against a cloned array.
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (!isImageModule(asset.module)) continue;
    const content = asset.content as ImageContent | null;
    if (!content || !Array.isArray(content.variants)) continue;
    const bucket = MODULE_BUCKETS[asset.module as ImageModuleKey];

    for (let v = 0; v < content.variants.length; v++) {
      const variant = content.variants[v];
      if (typeof variant?.storagePath === "string" && variant.storagePath) {
        targets.push({
          assetIdx: i,
          variantIdx: v,
          path: variant.storagePath,
          bucket,
        });
      } else if (variant) {
        fallbacks.push({
          assetId: asset.id,
          module: asset.module,
          variantIdx: v,
        });
      }
    }
  }

  if (fallbacks.length > 0) {
    console.warn(
      `[resolve-variants] ${fallbacks.length} variant(s) missing storagePath; falling back to existing url`,
      fallbacks,
    );
  }

  if (targets.length === 0) {
    // Nothing to sign — every asset is non-image or has only fallback rows.
    return assets;
  }

  // Pass 2: group by bucket, batch-sign, build lookup map keyed by "bucket:path".
  const byBucket = new Map<string, string[]>();
  for (const t of targets) {
    const list = byBucket.get(t.bucket) ?? [];
    list.push(t.path);
    byBucket.set(t.bucket, list);
  }

  const supabase = createServiceClient();
  const signed = new Map<string, string>();
  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, IMAGE_RENDER_TTL_SECONDS);
      if (error) {
        console.warn(
          `[resolve-variants] batch sign failed for bucket=${bucket}: ${error.message}`,
        );
        return;
      }
      for (const item of data ?? []) {
        if (item.error) {
          console.warn(
            `[resolve-variants] sign failed for ${bucket}/${item.path}: ${item.error}`,
          );
          continue;
        }
        if (item.path && item.signedUrl) {
          signed.set(`${bucket}:${item.path}`, item.signedUrl);
        }
      }
    }),
  );

  // Pass 3: clone assets that have signed URLs to apply, mutate the copies.
  // We only clone assets that need changing; untouched rows pass through.
  const touchedAssetIdxs = new Set(targets.map((t) => t.assetIdx));
  const out = assets.map((a, idx) => {
    if (!touchedAssetIdxs.has(idx)) return a;
    const content = a.content as ImageContent;
    const nextVariants = content.variants.map((v) => ({ ...v }));
    return {
      ...a,
      content: { ...content, variants: nextVariants } as object,
    };
  });

  for (const t of targets) {
    const url = signed.get(`${t.bucket}:${t.path}`);
    if (!url) continue;
    const content = out[t.assetIdx].content as ImageContent;
    content.variants[t.variantIdx].url = url;
  }

  return out;
}
