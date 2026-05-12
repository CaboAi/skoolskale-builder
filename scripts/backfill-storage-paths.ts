/**
 * Backfill `storagePath` (for image-module variants) and `creator_photo_path`
 * (on the creators table) from the existing public URLs persisted in the DB.
 *
 * Stage 1 of the signed-URLs migration (see memory/signed-urls-migration.md).
 * Purely additive — leaves existing `url` and `creator_photo_url` values
 * untouched so the app continues to function while subsequent stages roll
 * out. Re-run as many times as you want; rows already containing the new
 * fields are skipped.
 *
 * Run: `pnpm backfill:storage-paths`
 */
import postgres from "postgres";
import { parsePublicStorageUrl } from "@/lib/storage/parse-public-url";

const IMAGE_MODULES = [
  "cover",
  "icon",
  "classroom_cover",
  "calendar_cover",
] as const;

type ImageVariant = {
  url?: string;
  storagePath?: string;
  index: number;
};

type ImageContent = {
  variants?: ImageVariant[];
  selected_variant_index?: number;
};

type RowOutcome =
  | { id: string; status: "updated"; addedPaths: number }
  | { id: string; status: "skipped"; reason: string }
  | { id: string; status: "error"; reason: string };

async function backfillAssets(sql: ReturnType<typeof postgres>) {
  const rows = await sql<
    { id: string; module: string; content: ImageContent }[]
  >`
    select id, module, content
    from generated_assets
    where module in ${sql(IMAGE_MODULES as unknown as string[])}
  `;
  console.log(`[backfill:assets] scanning ${rows.length} image asset rows`);

  const outcomes: RowOutcome[] = [];
  for (const row of rows) {
    try {
      const variants = row.content?.variants;
      if (!Array.isArray(variants) || variants.length === 0) {
        outcomes.push({
          id: row.id,
          status: "skipped",
          reason: "no variants",
        });
        continue;
      }

      // Idempotency check: every variant already has storagePath set.
      const allHavePath = variants.every(
        (v) => typeof v.storagePath === "string" && v.storagePath.length > 0,
      );
      if (allHavePath) {
        outcomes.push({
          id: row.id,
          status: "skipped",
          reason: "already backfilled",
        });
        continue;
      }

      const nextVariants: ImageVariant[] = [];
      let addedPaths = 0;
      let firstParseError: string | null = null;

      for (const variant of variants) {
        if (typeof variant.storagePath === "string" && variant.storagePath) {
          nextVariants.push(variant);
          continue;
        }
        if (typeof variant.url !== "string" || !variant.url) {
          if (!firstParseError) firstParseError = "variant missing url";
          nextVariants.push(variant);
          continue;
        }
        const parsed = parsePublicStorageUrl(variant.url);
        if (!parsed) {
          if (!firstParseError) {
            firstParseError = `unparseable url: ${variant.url.slice(0, 80)}`;
          }
          nextVariants.push(variant);
          continue;
        }
        nextVariants.push({ ...variant, storagePath: parsed.path });
        addedPaths += 1;
      }

      if (addedPaths === 0) {
        outcomes.push({
          id: row.id,
          status: "skipped",
          reason: firstParseError ?? "nothing to add",
        });
        continue;
      }

      const nextContent: ImageContent = {
        ...row.content,
        variants: nextVariants,
      };
      // postgres-js doesn't expose a typed JSONB writer for arbitrary
      // shapes; stringify + explicit cast is the conventional escape.
      await sql`
        update generated_assets
        set content = ${JSON.stringify(nextContent)}::jsonb
        where id = ${row.id}
      `;
      outcomes.push({ id: row.id, status: "updated", addedPaths });
    } catch (err) {
      outcomes.push({
        id: row.id,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return outcomes;
}

async function backfillCreators(sql: ReturnType<typeof postgres>) {
  const rows = await sql<{ id: string; creator_photo_url: string }[]>`
    select id, creator_photo_url
    from creators
    where creator_photo_url is not null
      and creator_photo_path is null
  `;
  console.log(`[backfill:creators] scanning ${rows.length} creator rows`);

  const outcomes: RowOutcome[] = [];
  for (const row of rows) {
    try {
      const parsed = parsePublicStorageUrl(row.creator_photo_url);
      if (!parsed) {
        outcomes.push({
          id: row.id,
          status: "skipped",
          reason: `unparseable url: ${row.creator_photo_url.slice(0, 80)}`,
        });
        continue;
      }
      await sql`
        update creators
        set creator_photo_path = ${parsed.path}
        where id = ${row.id}
      `;
      outcomes.push({ id: row.id, status: "updated", addedPaths: 1 });
    } catch (err) {
      outcomes.push({
        id: row.id,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return outcomes;
}

function summarize(label: string, outcomes: RowOutcome[]) {
  const updated = outcomes.filter((o) => o.status === "updated").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  const errored = outcomes.filter((o) => o.status === "error").length;
  console.log(
    `[backfill:${label}] updated=${updated} skipped=${skipped} errored=${errored}`,
  );
  for (const o of outcomes) {
    if (o.status === "error") {
      console.error(`  [error] ${o.id}: ${o.reason}`);
    } else if (o.status === "skipped" && o.reason !== "already backfilled") {
      console.warn(`  [skip]  ${o.id}: ${o.reason}`);
    }
  }
  return { updated, skipped, errored };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[backfill] DATABASE_URL is not set");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  try {
    const assetOutcomes = await backfillAssets(sql);
    const creatorOutcomes = await backfillCreators(sql);
    const aSum = summarize("assets", assetOutcomes);
    const cSum = summarize("creators", creatorOutcomes);
    const totalErrors = aSum.errored + cSum.errored;
    if (totalErrors > 0) {
      console.error(`[backfill] completed with ${totalErrors} errors`);
      process.exit(1);
    }
    console.log("[backfill] OK");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("[backfill] fatal:", e);
  process.exit(1);
});
