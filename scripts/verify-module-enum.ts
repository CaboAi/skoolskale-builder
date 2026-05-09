/**
 * Verify the prod `module` Postgres enum matches the canonical
 * Drizzle schema (`src/lib/db/schema.ts` → `moduleEnum.enumValues`).
 *
 * Run: pnpm verify:enum
 *
 * Idempotent — read-only against prod. Exits 0 when the enum in the DB
 * is a superset of the schema's declared values (extra DB-side values
 * are tolerated; missing values fail). Use after applying any migration
 * that adds enum members to confirm the migration actually landed.
 */
import postgres from "postgres";
import { moduleEnum } from "../src/lib/db/schema";

async function main() {
  const expected = [...moduleEnum.enumValues];
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const rows = await sql<
      { unnest: string }[]
    >`select unnest(enum_range(NULL::module)) as unnest`;
    const live = rows.map((r) => r.unnest);
    console.log("[verify:enum] live values:", live);
    const missing = expected.filter((v) => !live.includes(v));
    if (missing.length) {
      console.error("[verify:enum] MISSING from prod:", missing);
      console.error(
        "[verify:enum] FIX: npx dotenv -e .env.local -- drizzle-kit migrate",
      );
      process.exit(1);
    }
    const expectedSet: ReadonlySet<string> = new Set(expected);
    const extra = live.filter((v) => !expectedSet.has(v));
    if (extra.length) {
      console.warn(
        "[verify:enum] WARN — DB has values not in schema (likely stale, not blocking):",
        extra,
      );
    }
    console.log(
      `[verify:enum] OK — all ${expected.length} schema values present in prod`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("[verify:enum] fatal:", e);
  process.exit(1);
});
