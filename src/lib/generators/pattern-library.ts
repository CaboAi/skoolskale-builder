import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { patternLibrary } from '@/lib/db/schema';
import type { PatternExample, GeneratorModule } from '@/types/generators';

const DEFAULT_LIMIT = 3;

type Tone = 'loving' | 'direct' | 'playful';
type Niche =
  | 'spiritual'
  | 'business'
  | 'fitness'
  | 'relationships'
  | 'money'
  | 'yoga'
  | 'other';

type FetchArgs = {
  module: GeneratorModule;
  niche: Niche;
  tone: Tone;
  limit?: number;
};

/**
 * Fetch the top-N pattern library examples for a generator.
 *
 * Strategy (PRD §7.2):
 *   1. module + niche + tone, ordered by quality_rank desc
 *   2. if empty, module + niche (any tone)
 *   3. if empty, module + niche=null (universal)
 *   4. if still empty, []
 *
 * Returns rows already shaped as `PatternExample` — prompts receive a
 * single consistent type regardless of which fallback hit.
 */
export async function fetchPatternExamples(
  args: FetchArgs,
): Promise<PatternExample[]> {
  const limit = args.limit ?? DEFAULT_LIMIT;

  // 1. Exact niche + tone match.
  const exact = await db
    .select()
    .from(patternLibrary)
    .where(
      and(
        eq(patternLibrary.module, args.module),
        eq(patternLibrary.niche, args.niche),
        eq(patternLibrary.tone, args.tone),
        eq(patternLibrary.isActive, true),
      ),
    )
    .orderBy(desc(patternLibrary.qualityRank))
    .limit(limit);
  if (exact.length > 0) return exact.map(toExample);

  // 2. Same niche, any tone.
  const nicheOnly = await db
    .select()
    .from(patternLibrary)
    .where(
      and(
        eq(patternLibrary.module, args.module),
        eq(patternLibrary.niche, args.niche),
        eq(patternLibrary.isActive, true),
      ),
    )
    .orderBy(desc(patternLibrary.qualityRank))
    .limit(limit);
  if (nicheOnly.length > 0) return nicheOnly.map(toExample);

  // 3. Universal (niche=null) fallback.
  const universal = await db
    .select()
    .from(patternLibrary)
    .where(
      and(
        eq(patternLibrary.module, args.module),
        isNull(patternLibrary.niche),
        eq(patternLibrary.isActive, true),
      ),
    )
    .orderBy(desc(patternLibrary.qualityRank))
    .limit(limit);
  return universal.map(toExample);
}

function toExample(
  row: typeof patternLibrary.$inferSelect,
): PatternExample {
  return {
    tone: row.tone,
    niche: row.niche,
    sourceCreator: row.sourceCreator,
    content: stringifyContent(row.exampleContent),
    raw: row.exampleContent,
  };
}

/**
 * Text-module patterns have `{ text: "..." }`; structured modules have
 * richer shapes. Serialize consistently — prompts can either read `.content`
 * (prose-friendly) or `.raw` (structured-friendly).
 */
function stringifyContent(payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'text' in payload &&
    typeof (payload as { text: unknown }).text === 'string'
  ) {
    return (payload as { text: string }).text;
  }
  return JSON.stringify(payload, null, 2);
}
