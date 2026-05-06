import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/categories';

function buildRaw(rows: { name: string; description: string }[]): string {
  const inner = rows
    .map(
      (r, i) => `<category index="${i + 1}">
<name>${r.name}</name>
<description>${r.description}</description>
</category>`,
    )
    .join('\n');
  return `<categories>\n${inner}\n</categories>`;
}

const THREE = [
  { name: 'Plant your flag', description: 'Say hi and tell us why you joined.' },
  { name: 'Wins of the week', description: 'Celebrate progress, big or small.' },
  { name: 'Ask the host', description: 'Tips and answers from the creator.' },
];

describe('categories.parseOutput', () => {
  test('parses exactly 3 categories', () => {
    const out = parseOutput(buildRaw(THREE));
    expect(out.categories).toHaveLength(3);
    expect(out.categories[0].name).toBe('Plant your flag');
  });

  test('throws when <categories> wrapper is missing', () => {
    expect(() => parseOutput('hi')).toThrow(/missing <categories>/);
  });

  test('throws when fewer than 3 categories returned', () => {
    expect(() => parseOutput(buildRaw(THREE.slice(0, 2)))).toThrow(
      /expected 3 categories, got 2/,
    );
  });

  test('throws when more than 3 categories returned', () => {
    const four = [...THREE, { name: 'Off topic', description: 'misc' }];
    expect(() => parseOutput(buildRaw(four))).toThrow(
      /expected 3 categories, got 4/,
    );
  });

  test('throws on empty name', () => {
    const bad = [
      { name: '', description: 'x' },
      THREE[1],
      THREE[2],
    ];
    expect(() => parseOutput(buildRaw(bad))).toThrow(/name 1 is empty/);
  });

  test('throws on empty description', () => {
    const bad = [
      THREE[0],
      { name: 'ok', description: '' },
      THREE[2],
    ];
    expect(() => parseOutput(buildRaw(bad))).toThrow(/description 2 is empty/);
  });

  test('throws when name exceeds 60 chars', () => {
    const bad = [
      { name: 'a'.repeat(61), description: 'x' },
      THREE[1],
      THREE[2],
    ];
    expect(() => parseOutput(buildRaw(bad))).toThrow(/name 1 is 61 chars/);
  });
});
