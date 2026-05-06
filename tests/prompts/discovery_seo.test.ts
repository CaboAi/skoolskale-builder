import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/discovery_seo';

function buildRaw(keywords: string[]): string {
  const inner = keywords.map((k) => `<keyword>${k}</keyword>`).join('\n');
  return `<discovery_seo>\n${inner}\n</discovery_seo>`;
}

const ELEVEN = [
  'yoga teachers',
  'morning practice',
  'breathwork',
  'mindfulness',
  'kundalini',
  'soul-led entrepreneurs',
  'spiritual business',
  'manifestation',
  'energetic alignment',
  'sacred feminine',
  'embodied leadership',
];

describe('discovery_seo.parseOutput', () => {
  test('parses exactly 11 keywords', () => {
    const out = parseOutput(buildRaw(ELEVEN));
    expect(out.keywords).toEqual(ELEVEN);
  });

  test('throws when <discovery_seo> wrapper is missing', () => {
    expect(() => parseOutput('hi')).toThrow(/missing <discovery_seo>/);
  });

  test('throws when fewer than 11 keywords', () => {
    expect(() => parseOutput(buildRaw(ELEVEN.slice(0, 5)))).toThrow(
      /expected 11 keywords, got 5/,
    );
  });

  test('throws when more than 11 keywords', () => {
    const twelve = [...ELEVEN, 'extra'];
    expect(() => parseOutput(buildRaw(twelve))).toThrow(
      /expected 11 keywords, got 12/,
    );
  });

  test('throws on empty keyword', () => {
    const bad = ELEVEN.slice();
    bad[3] = '';
    expect(() => parseOutput(buildRaw(bad))).toThrow(/keyword 4 is empty/);
  });

  test('throws on duplicate keywords (case-insensitive)', () => {
    const bad = ELEVEN.slice();
    bad[10] = 'YOGA TEACHERS'; // dup of index 0
    expect(() => parseOutput(buildRaw(bad))).toThrow(/duplicate keyword/);
  });

  test('throws when a keyword exceeds 40 chars', () => {
    const bad = ELEVEN.slice();
    bad[0] = 'a'.repeat(41);
    expect(() => parseOutput(buildRaw(bad))).toThrow(/keyword 1 is 41 chars/);
  });
});
