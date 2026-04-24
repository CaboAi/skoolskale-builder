/**
 * Idempotent storage bootstrap.
 * Ensures the `creator-photos` bucket exists: public read, authenticated write.
 * Also wires the storage.objects policies any authenticated user needs to
 * upload/update/delete within this bucket.
 *
 * Run: `pnpm storage:setup`
 */
import postgres from 'postgres';
import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'creator-photos';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

async function main() {
  const supabase = createServiceClient();

  const { data: list, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('[storage] listBuckets failed:', listErr.message);
    process.exit(1);
  }

  const exists = list?.some((b) => b.name === BUCKET);

  if (!exists) {
    console.log(`[storage] creating bucket "${BUCKET}" ...`);
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (createErr) {
      console.error('[storage] createBucket failed:', createErr.message);
      process.exit(1);
    }
  } else {
    console.log(`[storage] bucket "${BUCKET}" already exists — updating config`);
    const { error: updateErr } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (updateErr) {
      console.error('[storage] updateBucket failed:', updateErr.message);
      process.exit(1);
    }
  }

  // Storage RLS: public buckets get public SELECT automatically, but INSERT/
  // UPDATE/DELETE need explicit policies. Apply them via direct postgres
  // connection since the Supabase admin JS API can't manage storage policies.
  console.log('[storage] applying storage.objects policies ...');
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const policies = [
    {
      name: 'creator_photos_authed_insert',
      body: `CREATE POLICY "creator_photos_authed_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = '${BUCKET}')`,
    },
    {
      name: 'creator_photos_authed_update',
      body: `CREATE POLICY "creator_photos_authed_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = '${BUCKET}') WITH CHECK (bucket_id = '${BUCKET}')`,
    },
    {
      name: 'creator_photos_authed_delete',
      body: `CREATE POLICY "creator_photos_authed_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = '${BUCKET}')`,
    },
  ];
  for (const p of policies) {
    await sql.unsafe(`DROP POLICY IF EXISTS "${p.name}" ON storage.objects`);
    await sql.unsafe(p.body);
    console.log(`  [+] ${p.name}`);
  }
  await sql.end();

  console.log(`[storage] OK — "${BUCKET}" ready (public read, authenticated write).`);
}

main().catch((e) => {
  console.error('[storage] fatal:', e);
  process.exit(1);
});
