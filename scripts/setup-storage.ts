/**
 * Idempotent storage bootstrap.
 * Ensures all required buckets exist with the correct policies. Currently:
 *   - `creator-photos`    — user-uploaded creator portraits (jpg/png/webp)
 *   - `cover-variants`    — Gemini-generated cover image variants (png)
 *
 * Both buckets: public read, authenticated INSERT/UPDATE/DELETE on
 * storage.objects scoped by bucket_id.
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
};

const BUCKETS: BucketConfig[] = [
  {
    name: "creator-photos",
    policyPrefix: "creator_photos",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  {
    name: "cover-variants",
    policyPrefix: "cover_variants",
    allowedMimeTypes: ["image/png"],
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
    public: true,
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

  const names = BUCKETS.map((b) => `"${b.name}"`).join(", ");
  console.log(
    `[storage] OK — ${names} ready (public read, authenticated write).`,
  );
}

main().catch((e) => {
  console.error("[storage] fatal:", e);
  process.exit(1);
});
