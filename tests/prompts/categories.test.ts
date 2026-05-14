import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/categories';

function buildRaw(names: string[]): string {
  const inner = names
    .map(
      (n, i) => `<category index="${i + 1}">
<name>${n}</name>
</category>`,
    )
    .join('\n');
  return `<categories>\n${inner}\n</categories>`;
}

const THREE = ['Plant your flag', 'Wins of the week', 'Ask the host'];

describe('categories.parseOutput', () => {
  test('parses exactly 3 category names', () => {
    const out = parseOutput(buildRaw(THREE));
    expect(out.categories).toEqual(THREE);
  });

  test('ignores any <description> tags the model emits despite the prompt forbidding them', () => {
    // Forward-compatibility check: if Claude accidentally adds a description,
    // the title-only parser regex matches name-only blocks. The raw string
    // includes a description that should be discarded by the parser shape.
    const raw = `<categories>
<category index="1"><name>Hello</name><description>ignored</description></category>
<category index="2"><name>Wins</name></category>
<category index="3"><name>Q&A</name></category>
</categories>`;
    // Our regex requires </category> right after </name>, so a description
    // between them means we'd parse 2 instead of 3 — assert the strict-mode
    // behavior so the prompt and parser stay in lock-step.
    expect(() => parseOutput(raw)).toThrow(/expected 3 categories, got 2/);
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
    expect(() => parseOutput(buildRaw([...THREE, 'Off topic']))).toThrow(
      /expected 3 categories, got 4/,
    );
  });

  test('throws on empty name', () => {
    expect(() => parseOutput(buildRaw(['', 'b', 'c']))).toThrow(
      /name 1 is empty/,
    );
  });

  test('throws when name exceeds 60 chars', () => {
    expect(() => parseOutput(buildRaw(['a'.repeat(61), 'b', 'c']))).toThrow(
      /name 1 is 61 chars/,
    );
  });
});
