import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { generatedAssets } from '@/lib/db/schema';
import { FALLBACK_INTRO_CATEGORY } from '@/prompts/first-post';

/**
 * Resolve the intro-category name for the first_post module.
 *
 * The first_post body says "introduce yourself in the <name> category" —
 * the name has to match what the categories module actually generated.
 * Cross-module dependency, resolved by polling the generated_assets
 * table for the categories asset on the same package.
 *
 * Polling (not Inngest event sequencing) is the v1 strategy: it works
 * with the existing parallel orchestrator dispatch without restructuring
 * how modules are kicked off. The 15s total window comfortably exceeds
 * typical Claude module generation time. If the dependency graph grows
 * past one edge, we can evolve to event-based sequencing later.
 *
 * Fallback ladder (each step independently):
 *   - Asset missing after the polling window → FALLBACK_INTRO_CATEGORY.
 *   - Asset present but content shape is unrecognised → FALLBACK.
 *   - Asset present, parseable, but no name matches /intro/i → FALLBACK.
 *   - Asset present with a /intro/i match → use that literal name.
 *
 * `slot 0` (the canonical intro slot per the categories prompt) is NOT
 * an implicit fallback here. The brief is intentional: regex match or
 * the generic Skool default. Creators whose intro-equivalent category
 * doesn't contain "intro" in the name (e.g. "Plant your flag") will
 * land on FALLBACK; the VA edits the first_post body manually in that
 * case. Keeps the heuristic predictable.
 */

export type IntroCategoryResolverDeps = {
  /** Sleep helper — injected so tests can run with a zero-delay stub. */
  sleep?: (ms: number) => Promise<void>;
  /** Override the poll schedule. Defaults to 0, 1s, 2s, 4s, 8s. */
  delays?: readonly number[];
};

const DEFAULT_DELAYS_MS: readonly number[] = [0, 1_000, 2_000, 4_000, 8_000];

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function resolveIntroCategory(
  packageId: string,
  deps: IntroCategoryResolverDeps = {},
): Promise<string> {
  const sleep = deps.sleep ?? realSleep;
  const delays = deps.delays ?? DEFAULT_DELAYS_MS;

  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    const match = await tryReadIntroCategory(packageId);
    if (match !== undefined) return match;
  }
  return FALLBACK_INTRO_CATEGORY;
}

/**
 * Single DB read + content scan. Returns:
 *   - string: an intro-matching name was found (use it)
 *   - FALLBACK_INTRO_CATEGORY: asset was present but no name matched
 *     (no point in polling further — the categories module is done and
 *     it didn't produce an intro-named slot)
 *   - undefined: asset missing or corrupted, caller should keep polling
 */
async function tryReadIntroCategory(
  packageId: string,
): Promise<string | undefined> {
  const [asset] = await db
    .select({ content: generatedAssets.content })
    .from(generatedAssets)
    .where(
      and(
        eq(generatedAssets.packageId, packageId),
        eq(generatedAssets.module, 'categories'),
      ),
    )
    .limit(1);
  if (!asset) return undefined;

  const names = readCategoryNames(asset.content);
  if (!names) return undefined; // corrupted content — keep polling in case a newer row lands
  const match = names.find((n) => /intro/i.test(n));
  return match ?? FALLBACK_INTRO_CATEGORY;
}

function readCategoryNames(content: unknown): string[] | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const cat = (content as { categories?: unknown }).categories;
  if (!Array.isArray(cat)) return undefined;
  const names = cat.filter((c): c is string => typeof c === 'string');
  if (names.length === 0) return undefined;
  return names;
}
