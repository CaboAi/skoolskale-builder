import { describe, expect, test } from 'vitest';
import {
  PERKS_CATEGORY_INDEX,
  buildUserMessage,
  parseOutput,
} from '@/prompts/categories';
import type { CreatorContext, GeneratorInput } from '@/types/generators';

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
const FOUR = [...THREE, 'Member gifts'];
const PERKS = ['Private podcast', 'Monthly hot seat'];

function makeInput(perks: string[]): GeneratorInput {
  const creator: CreatorContext = {
    name: 'Nancy',
    community_name: 'Golden Breadcrumbs',
    niche: 'spiritual',
    audience: 'people navigating hard seasons',
    transformation: 'find evidence that impossible things are possible',
    tone: 'warm',
    offer_breakdown: { perks, guest_sessions: false },
    pricing: { free_community: false, additional_tiers: [] },
    trial_terms: { has_trial: true, duration_days: 7 as const },
    refund_policy: '',
    support_contact: 'support@example.test',
    brand_prefs: '',
  };
  return { creator, patternLibrary: [] };
}

describe('categories.parseOutput without intake (prompt-editor path)', () => {
  test.each([
    ['3 names', THREE],
    ['4 names', FOUR],
  ])('accepts %s', (_label, names) => {
    expect(parseOutput(buildRaw(names)).categories).toEqual(names);
  });

  test('ignores any <description> tags the model emits despite the prompt forbidding them', () => {
    // Our regex requires </category> right after </name>, so a description
    // between them means we'd parse 2 instead of 3 — assert the strict-mode
    // behavior so the prompt and parser stay in lock-step.
    const raw = `<categories>
<category index="1"><name>Hello</name><description>ignored</description></category>
<category index="2"><name>Wins</name></category>
<category index="3"><name>Q&A</name></category>
</categories>`;
    expect(() => parseOutput(raw)).toThrow(/expected 3 or 4 categories, got 2/);
  });

  test('throws when <categories> wrapper is missing', () => {
    expect(() => parseOutput('hi')).toThrow(/missing <categories>/);
  });

  test.each([
    ['fewer than 3', THREE.slice(0, 2), 2],
    ['more than 4', [...FOUR, 'Off topic'], 5],
  ])('throws when %s categories returned', (_label, names, got) => {
    expect(() => parseOutput(buildRaw(names))).toThrow(
      `expected 3 or 4 categories, got ${got}`,
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

describe('categories.parseOutput with intake', () => {
  test('perks creator: the 4th name lands at PERKS_CATEGORY_INDEX', () => {
    const out = parseOutput(buildRaw(FOUR), makeInput(PERKS));
    expect(out.categories[PERKS_CATEGORY_INDEX]).toBe('Member gifts');
  });

  test('perks creator: 3 names is rejected so Inngest retries', () => {
    expect(() => parseOutput(buildRaw(THREE), makeInput(PERKS))).toThrow(
      'expected 4 categories, got 3',
    );
  });

  test('no-perks creator: a 4th name is rejected', () => {
    expect(() => parseOutput(buildRaw(FOUR), makeInput([]))).toThrow(
      'expected 3 categories, got 4',
    );
  });

  test('blank-only perks count as no perks', () => {
    expect(parseOutput(buildRaw(THREE), makeInput(['  ', ''])).categories).toEqual(
      THREE,
    );
  });
});

describe('categories.buildUserMessage', () => {
  test('perks creator is asked for 4 names including the perks slot', () => {
    const msg = buildUserMessage(makeInput(PERKS));
    expect(msg).toContain(
      'The creator HAS perks (Private podcast; Monthly hot seat). Write 4 category names in the canonical slot order (introduce, share-wins, creator-advice, perks).',
    );
  });

  test('no-perks creator is asked for 3 names', () => {
    const msg = buildUserMessage(makeInput([]));
    expect(msg).toContain(
      'The creator has NO perks. Write 3 category names in the canonical slot order (introduce, share-wins, creator-advice).',
    );
  });
});
