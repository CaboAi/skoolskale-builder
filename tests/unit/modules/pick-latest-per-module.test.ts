import { describe, expect, test } from 'vitest';
import { pickLatestPerModule } from '@/lib/db/packages';
import type { GeneratedAsset } from '@/lib/db/schema';

function asset(
  over: Partial<GeneratedAsset> & Pick<GeneratedAsset, 'id' | 'module'>,
): GeneratedAsset {
  return {
    packageId: 'pkg-1',
    version: 1,
    content: {},
    approved: false,
    approvedBy: null,
    approvedAt: null,
    editHistory: [],
    vaNotes: null,
    qualityScore: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-07-19T18:00:00Z'),
    ...over,
  } as GeneratedAsset;
}

describe('pickLatestPerModule', () => {
  test('keeps the first row per module and drops later duplicates', () => {
    const newest = asset({ id: 'newest', module: 'transformation', version: 3 });
    const rows = [
      newest,
      asset({ id: 'middle', module: 'transformation', version: 2 }),
      asset({ id: 'oldest', module: 'transformation', version: 1 }),
    ];
    expect(pickLatestPerModule(rows)).toEqual([newest]);
  });

  test('returns one row per distinct module, preserving encounter order', () => {
    const rows = [
      asset({ id: 'a', module: 'transformation' }),
      asset({ id: 'b', module: 'about_us' }),
      asset({ id: 'c', module: 'transformation' }),
    ];
    expect(pickLatestPerModule(rows).map((r) => r.id)).toEqual(['a', 'b']);
  });

  test('empty input yields an empty array', () => {
    expect(pickLatestPerModule([])).toEqual([]);
  });
});
