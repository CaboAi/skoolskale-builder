import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/leaderboard';

const NINE = [
  'Newcomer',
  'Explorer',
  'Member',
  'Contributor',
  'Advocate',
  'Mentor',
  'Champion',
  'Leader',
  'Founder',
];

function buildRaw(levels: string[]): string {
  const tags = levels
    .map((name, i) => `<level_${i + 1}>${name}</level_${i + 1}>`)
    .join('\n');
  return `<leaderboard>\n${tags}\n</leaderboard>`;
}

describe('leaderboard.parseOutput', () => {
  test('parses 9 valid levels in order', () => {
    const out = parseOutput(buildRaw(NINE));
    expect(out.levels).toEqual(NINE);
  });

  test('throws when <leaderboard> wrapper is missing', () => {
    expect(() => parseOutput('hi')).toThrow(/missing <leaderboard>/);
  });

  test('throws when any level tag is missing', () => {
    const raw = buildRaw(NINE).replace(/<level_5>[^<]+<\/level_5>\n/, '');
    expect(() => parseOutput(raw)).toThrow(/missing <level_5>/);
  });

  test('throws on an empty level', () => {
    const eight = NINE.slice();
    eight[3] = '';
    expect(() => parseOutput(buildRaw(eight))).toThrow(/level 4 is empty/);
  });

  test('throws when a level exceeds 30 chars', () => {
    const overlong = NINE.slice();
    overlong[2] = 'a'.repeat(31);
    expect(() => parseOutput(buildRaw(overlong))).toThrow(
      /level 3 is 31 chars/,
    );
  });

  test('throws on duplicate level names (case-insensitive)', () => {
    const dupes = NINE.slice();
    dupes[7] = 'newcomer'; // dup of level 1 "Newcomer"
    expect(() => parseOutput(buildRaw(dupes))).toThrow(/duplicate level name/);
  });
});
