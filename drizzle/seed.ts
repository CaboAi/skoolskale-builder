/**
 * Pattern library seed.
 *
 * Reads /seeds/patterns.json (keyed by module) and inserts into pattern_library
 * using the Supabase service-role client (bypasses RLS).
 *
 * Idempotency:
 *   - default: aborts if pattern_library already has rows, to avoid duplicates
 *   - --reset: deletes all existing rows first, then inserts
 *
 * Usage:
 *   pnpm db:seed              # safe seed (no-op if already seeded)
 *   pnpm db:seed -- --reset   # wipe + reseed
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServiceClient } from '@/lib/supabase/server';

type Module =
  | 'welcome_dm'
  | 'transformation'
  | 'about_us'
  | 'start_here'
  | 'cover'
  | 'icon'
  | 'start_here_thumb'
  | 'join_now_banner';

type Tone = 'loving' | 'direct' | 'playful';

type Niche =
  | 'spiritual'
  | 'business'
  | 'fitness'
  | 'relationships'
  | 'money'
  | 'yoga'
  | 'other';

type PatternInput = {
  niche: Niche | null;
  tone: Tone | null;
  source_creator: string | null;
  example_content: unknown;
};

type PatternsFile = Partial<Record<Module, PatternInput[]>>;

type PatternRow = {
  module: Module;
  niche: Niche | null;
  tone: Tone | null;
  source_creator: string | null;
  example_content: unknown;
  quality_rank: number;
  is_active: boolean;
};

function loadPatterns(): PatternRow[] {
  const path = resolve(process.cwd(), 'seeds', 'patterns.json');
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw) as PatternsFile;

  const rows: PatternRow[] = [];
  for (const [mod, entries] of Object.entries(data)) {
    if (!entries) continue;
    for (const e of entries) {
      rows.push({
        module: mod as Module,
        niche: e.niche,
        tone: e.tone,
        source_creator: e.source_creator,
        example_content: e.example_content,
        quality_rank: 50,
        is_active: true,
      });
    }
  }
  return rows;
}

async function main() {
  const reset = process.argv.includes('--reset');
  const supabase = createServiceClient();

  const { count, error: countErr } = await supabase
    .from('pattern_library')
    .select('id', { count: 'exact', head: true });

  if (countErr) {
    console.error('[seed] count failed:', countErr.message);
    process.exit(1);
  }

  const existing = count ?? 0;

  if (existing > 0 && !reset) {
    console.log(
      `[seed] pattern_library already has ${existing} rows. ` +
        `Pass --reset to wipe and reseed.`,
    );
    process.exit(0);
  }

  if (reset && existing > 0) {
    console.log(`[seed] --reset: deleting ${existing} existing rows...`);
    // Supabase requires a filter on delete; id is a uuid, all are non-null.
    const { error: delErr } = await supabase
      .from('pattern_library')
      .delete()
      .not('id', 'is', null);
    if (delErr) {
      console.error('[seed] delete failed:', delErr.message);
      process.exit(1);
    }
  }

  const rows = loadPatterns();
  console.log(`[seed] inserting ${rows.length} pattern(s)...`);

  const { data, error } = await supabase
    .from('pattern_library')
    .insert(rows)
    .select('id, module, source_creator');

  if (error) {
    console.error('[seed] insert failed:', error.message);
    process.exit(1);
  }

  console.log(`[seed] OK — inserted ${data?.length ?? 0} rows.`);
  const byModule = new Map<string, number>();
  for (const r of data ?? []) byModule.set(r.module, (byModule.get(r.module) ?? 0) + 1);
  for (const [m, n] of byModule) console.log(`         ${m}: ${n}`);
}

main().catch((e) => {
  console.error('[seed] fatal:', e);
  process.exit(1);
});
