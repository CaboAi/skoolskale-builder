/**
 * Verify the prod Postgres enums (`module`, `tone`) match the canonical
 * Drizzle schema (`src/lib/db/schema.ts`).
 *
 * Run: pnpm verify:enum
 *
 * Idempotent — read-only against prod. For each enum, exits 0 when the
 * DB-side values are a superset of the schema's declared values (extras
 * are tolerated; missing values fail). Use after applying any migration
 * that adds or renames enum members to confirm the migration landed.
 */
import postgres from "postgres";
import { moduleEnum, toneEnum } from "../src/lib/db/schema";

type EnumCheck = {
  name: string;
  expected: readonly string[];
};

async function checkEnum(
  sql: ReturnType<typeof postgres>,
  check: EnumCheck,
): Promise<boolean> {
  const rows = await sql<{ unnest: string }[]>`
    select unnest(enum_range(NULL::${sql(check.name)})) as unnest
  `;
  const live = rows.map((r) => r.unnest);
  console.log(`[verify:enum] ${check.name} live values:`, live);

  const missing = check.expected.filter((v) => !live.includes(v));
  if (missing.length) {
    console.error(`[verify:enum] ${check.name} MISSING from prod:`, missing);
    return false;
  }
  const expectedSet: ReadonlySet<string> = new Set(check.expected);
  const extra = live.filter((v) => !expectedSet.has(v));
  if (extra.length) {
    console.warn(
      `[verify:enum] ${check.name} WARN — DB has values not in schema (likely stale, not blocking):`,
      extra,
    );
  }
  console.log(
    `[verify:enum] ${check.name} OK — all ${check.expected.length} schema values present in prod`,
  );
  return true;
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const checks: EnumCheck[] = [
      { name: "module", expected: [...moduleEnum.enumValues] },
      { name: "tone", expected: [...toneEnum.enumValues] },
    ];
    const results = await Promise.all(checks.map((c) => checkEnum(sql, c)));
    if (results.some((ok) => !ok)) {
      console.error(
        "[verify:enum] FIX: npx dotenv -e .env.local -- drizzle-kit migrate",
      );
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("[verify:enum] fatal:", e);
  process.exit(1);
});
