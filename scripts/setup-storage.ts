/**
 * Idempotent storage bootstrap.
 * Ensures all required buckets exist with the correct policies. Currently:
 *   - `creator-photos`    — user-uploaded creator portraits (jpg/png/webp).
 *                           PUBLIC for now (wizard preview still uses
 *                           public URLs); follow-up PR rewrites the
 *                           upload component to use signed URLs and flips
 *                           this bucket private too.
 *   - `cover-variants`    — Gemini-generated cover image variants (png).
 *                           PRIVATE — read access only via service-role
 *                           signed URLs (`resolveAssetUrls`).
 *   - `image-variants`    — Gemini-generated image variants for non-cover
 *                           image modules (icon, classroom_cover,
 *                           calendar_cover). Subpathed by `${packageId}/${module}/`.
 *                           PRIVATE — same model as cover-variants.
 *
 * Buckets: per-bucket `public` flag (see BUCKETS below). All buckets:
 * authenticated INSERT/UPDATE/DELETE on storage.objects scoped by
 * bucket_id. Read on private buckets goes through signed URLs only —
 * Stage 3 readers (`src/lib/storage/resolve-variants.ts`) batch-sign on
 * every page render with a 1-hour TTL.
 *
 * Run: `pnpm storage:setup`
 */
import postgres from "postgres";
import { createServiceClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

type BucketConfig = {
  name: string;
  policyPrefix: string; // e.g. 'creator_photos' → policies named creator_photos_authed_insert, ...
  allowedMimeTypes: string[];
  /**
   * When false the bucket is private and reads require a signed URL.
   * Signed-URLs migration Stage 4 flipped the two Gemini-output buckets
   * private; `creator-photos` stays public until the upload component
   * is migrated.
   */
  public: boolean;
};

const BUCKETS: BucketConfig[] = [
  {
    name: "creator-photos",
    policyPrefix: "creator_photos",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    public: true,
  },
  {
    name: "cover-variants",
    policyPrefix: "cover_variants",
    allowedMimeTypes: ["image/png"],
    public: false,
  },
  {
    name: "image-variants",
    policyPrefix: "image_variants",
    allowedMimeTypes: ["image/png"],
    public: false,
  },
];

async function ensureBucket(cfg: BucketConfig) {
  const supabase = createServiceClient();
  const { data: list, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("[storage] listBuckets failed:", listErr.message);
    process.exit(1);
  }
  const exists = list?.some((b) => b.name === cfg.name);

  const opts = {
    public: cfg.public,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: cfg.allowedMimeTypes,
  };

  if (!exists) {
    console.log(`[storage] creating bucket "${cfg.name}" ...`);
    const { error } = await supabase.storage.createBucket(cfg.name, opts);
    if (error) {
      console.error(
        `[storage] createBucket "${cfg.name}" failed:`,
        error.message,
      );
      process.exit(1);
    }
  } else {
    console.log(`[storage] bucket "${cfg.name}" exists — updating config`);
    const { error } = await supabase.storage.updateBucket(cfg.name, opts);
    if (error) {
      console.error(
        `[storage] updateBucket "${cfg.name}" failed:`,
        error.message,
      );
      process.exit(1);
    }
  }
}

async function applyPolicies(
  sql: ReturnType<typeof postgres>,
  cfg: BucketConfig,
) {
  // Storage RLS: public buckets get public SELECT automatically, but INSERT/
  // UPDATE/DELETE need explicit policies. Apply via direct postgres since the
  // Supabase admin JS API can't manage storage policies.
  const policies = [
    {
      name: `${cfg.policyPrefix}_authed_insert`,
      body: `CREATE POLICY "${cfg.policyPrefix}_authed_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = '${cfg.name}')`,
    },
    {
      name: `${cfg.policyPrefix}_authed_update`,
      body: `CREATE POLICY "${cfg.policyPrefix}_authed_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = '${cfg.name}') WITH CHECK (bucket_id = '${cfg.name}')`,
    },
    {
      name: `${cfg.policyPrefix}_authed_delete`,
      body: `CREATE POLICY "${cfg.policyPrefix}_authed_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = '${cfg.name}')`,
    },
  ];
  for (const p of policies) {
    await sql.unsafe(`DROP POLICY IF EXISTS "${p.name}" ON storage.objects`);
    await sql.unsafe(p.body);
    console.log(`  [+] ${p.name}`);
  }
}

async function main() {
  for (const cfg of BUCKETS) {
    await ensureBucket(cfg);
  }

  console.log("[storage] applying storage.objects policies ...");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    for (const cfg of BUCKETS) {
      await applyPolicies(sql, cfg);
    }
  } finally {
    await sql.end();
  }

  const summary = BUCKETS.map(
    (b) => `"${b.name}"=${b.public ? "public" : "private"}`,
  ).join(", ");
  console.log(
    `[storage] OK — ${summary} ready (authenticated INSERT/UPDATE/DELETE; private bucket reads require signed URLs).`,
  );
}

main().catch((e) => {
  console.error("[storage] fatal:", e);
  process.exit(1);
});
