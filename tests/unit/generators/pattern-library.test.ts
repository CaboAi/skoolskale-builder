/**
 * Unit tests for the pattern library fetch helper.
 *
 * The helper issues up to 3 chained queries (exact → niche-only → universal).
 * We mock @/lib/db with a queue-based fake so each test controls what each
 * SELECT returns.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const queue: unknown[][] = [];

vi.mock('@/lib/db', () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => queue.shift() ?? [],
          }),
        }),
      }),
    }),
  };
  return { db };
});

beforeEach(() => {
  queue.length = 0;
});

type Row = {
  tone: 'loving' | 'direct' | 'playful' | null;
  niche:
    | 'spiritual'
    | 'business'
    | 'fitness'
    | 'relationships'
    | 'money'
    | 'yoga'
    | 'other'
    | null;
  sourceCreator: string | null;
  exampleContent: unknown;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    tone: 'loving',
    niche: 'spiritual',
    sourceCreator: 'Test Creator',
    exampleContent: { text: 'hello example' },
    ...overrides,
  };
}

describe('fetchPatternExamples', () => {
  test('returns exact niche+tone matches when present', async () => {
    queue.push([row({ sourceCreator: 'A' }), row({ sourceCreator: 'B' })]);
    const { fetchPatternExamples } = await import(
      '@/lib/generators/pattern-library'
    );

    const result = await fetchPatternExamples({
      module: 'welcome_dm',
      niche: 'spiritual',
      tone: 'loving',
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.sourceCreator)).toEqual(['A', 'B']);
    expect(result[0].content).toBe('hello example');
  });

  test('falls back to niche-only when exact match is empty', async () => {
    queue.push([]); // exact: empty
    queue.push([row({ tone: 'direct', sourceCreator: 'C' })]); // niche-only hit
    const { fetchPatternExamples } = await import(
      '@/lib/generators/pattern-library'
    );

    const result = await fetchPatternExamples({
      module: 'about_us',
      niche: 'spiritual',
      tone: 'loving',
    });

    expect(result).toHaveLength(1);
    expect(result[0].sourceCreator).toBe('C');
    expect(result[0].tone).toBe('direct');
  });

  test('falls back to universal (niche=null) when niche has no examples', async () => {
    queue.push([]); // exact: empty
    queue.push([]); // niche-only: empty
    queue.push([row({ niche: null, tone: null, sourceCreator: 'Universal' })]);
    const { fetchPatternExamples } = await import(
      '@/lib/generators/pattern-library'
    );

    const result = await fetchPatternExamples({
      module: 'transformation',
      niche: 'fitness',
      tone: 'playful',
    });

    expect(result).toHaveLength(1);
    expect(result[0].niche).toBeNull();
    expect(result[0].sourceCreator).toBe('Universal');
  });

  test('returns [] when all fallbacks are empty', async () => {
    queue.push([], [], []);
    const { fetchPatternExamples } = await import(
      '@/lib/generators/pattern-library'
    );

    const result = await fetchPatternExamples({
      module: 'start_here',
      niche: 'money',
      tone: 'direct',
    });

    expect(result).toEqual([]);
  });

  test('structured (non-text) example content serializes to JSON string', async () => {
    const structured = {
      hero: 'H',
      trial_callout: 'T',
      value_buckets: [{ emoji: '💜', header: 'COURSES', items: ['A', 'B'] }],
    };
    queue.push([row({ exampleContent: structured })]);
    const { fetchPatternExamples } = await import(
      '@/lib/generators/pattern-library'
    );

    const result = await fetchPatternExamples({
      module: 'about_us',
      niche: 'spiritual',
      tone: 'loving',
    });

    expect(result).toHaveLength(1);
    // `raw` preserves structure for prompts that need it.
    expect(result[0].raw).toEqual(structured);
    // `content` stringifies for prompts that want a prose/blob fallback.
    const parsed = JSON.parse(result[0].content);
    expect(parsed.hero).toBe('H');
  });

  test('respects custom limit', async () => {
    queue.push([row(), row(), row(), row(), row()]);
    const { fetchPatternExamples } = await import(
      '@/lib/generators/pattern-library'
    );

    // The mock ignores LIMIT inside the query chain, but we assert the
    // helper still returns everything it's handed — the real contract is
    // "pass the number through to the DB". This test guards that we're
    // not dropping rows client-side.
    const result = await fetchPatternExamples({
      module: 'welcome_dm',
      niche: 'spiritual',
      tone: 'loving',
      limit: 5,
    });
    expect(result).toHaveLength(5);
  });
});
