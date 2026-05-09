/**
 * Verify the prod Supabase Storage buckets match what `setup-storage.ts`
 * declares: every expected bucket exists, is public, and has its 3 RLS
 * policies on `storage.objects`.
 *
 * Run: pnpm verify:bucket
 *
 * Idempotent — read-only against prod. Exits 0 when all expected buckets
 * are present and policy-shaped; exits 1 with a fix hint otherwise.
 *
 * Note: keep `EXPECTED` in sync with `scripts/setup-storage.ts`'s
 * `BUCKETS` array. A future refactor could `export const BUCKETS` from
 * setup-storage.ts and import it here; for now we duplicate the names
 * and keep the change footprint small.
 */
import postgres from "postgres";

type ExpectedBucket = {
  name: string;
  policyPrefix: string;
};

const EXPECTED: ExpectedBucket[] = [
  { name: "creator-photos", policyPrefix: "creator_photos" },
  { name: "cover-variants", policyPrefix: "cover_variants" },
  { name: "image-variants", policyPrefix: "image_variants" },
];

const POLICY_SUFFIXES = ["authed_insert", "authed_update", "authed_delete"];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  let failed = false;
  try {
    const buckets = await sql<
      {
        name: string;
        public: boolean;
        file_size_limit: number | null;
        allowed_mime_types: string[] | null;
      }[]
    >`
      select name, public, file_size_limit, allowed_mime_types
      from storage.buckets
      where name in ${sql(EXPECTED.map((b) => b.name))}
      order by name
    `;
    console.log("[verify:bucket] live buckets:");
    console.log(JSON.stringify(buckets, null, 2));

    for (const exp of EXPECTED) {
      const live = buckets.find((b) => b.name === exp.name);
      if (!live) {
        console.error(`[verify:bucket] MISSING bucket: ${exp.name}`);
        failed = true;
        continue;
      }
      if (!live.public) {
        console.error(
          `[verify:bucket] bucket ${exp.name} is NOT public (cover/icon URLs are public-read)`,
        );
        failed = true;
      }
    }

    const policies = await sql<{ name: string }[]>`
      select polname as name
      from pg_policy
      where polrelid = 'storage.objects'::regclass
      order by polname
    `;
    const policyNames = new Set(policies.map((p) => p.name));
    for (const exp of EXPECTED) {
      for (const suffix of POLICY_SUFFIXES) {
        const expected = `${exp.policyPrefix}_${suffix}`;
        if (!policyNames.has(expected)) {
          console.error(`[verify:bucket] MISSING policy: ${expected}`);
          failed = true;
        }
      }
    }

    if (failed) {
      console.error(
        "[verify:bucket] FIX: ANTHROPIC_API_KEY=placeholder pnpm storage:setup",
      );
      process.exit(1);
    }
    console.log(
      `[verify:bucket] OK — all ${EXPECTED.length} buckets present with ${EXPECTED.length * 3} RLS policies on storage.objects`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("[verify:bucket] fatal:", e);
  process.exit(1);
});
