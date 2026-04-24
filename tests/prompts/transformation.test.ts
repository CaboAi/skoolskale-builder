import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/transformation';

describe('transformation.parseOutput', () => {
  test('parses 3 valid tagline candidates', () => {
    const raw = `<taglines>
<tagline>Where manifestation ends and permanent reality shifting begins today.</tagline>
<tagline>The sanctuary where your soul stops performing and starts remembering.</tagline>
<tagline>Move from spiritual seeker to embodied source in six months.</tagline>
</taglines>`;
    const out = parseOutput(raw);
    expect(out.candidates).toHaveLength(3);
    expect(out.candidates[0]).toMatch(/manifestation/);
  });

  test('throws when <taglines> wrapper is missing', () => {
    expect(() => parseOutput('just some text')).toThrow(/missing <taglines>/);
  });

  test('throws when fewer than 3 candidates', () => {
    const raw = `<taglines>
<tagline>Only one candidate six words here.</tagline>
</taglines>`;
    expect(() => parseOutput(raw)).toThrow(/expected 3 candidates, got 1/);
  });

  test('throws when more than 3 candidates', () => {
    const raw = `<taglines>
<tagline>Candidate one here with some words to pass.</tagline>
<tagline>Candidate two here with some words to pass.</tagline>
<tagline>Candidate three here with some words to pass.</tagline>
<tagline>Candidate four here with some words to pass.</tagline>
</taglines>`;
    expect(() => parseOutput(raw)).toThrow(/expected 3 candidates, got 4/);
  });

  test('throws when a candidate is below 6 words', () => {
    const raw = `<taglines>
<tagline>Too short here.</tagline>
<tagline>This candidate has exactly seven words here okay.</tagline>
<tagline>Another perfectly valid candidate seven words long here.</tagline>
</taglines>`;
    expect(() => parseOutput(raw)).toThrow(
      /candidate 1 word count 3 out of range/,
    );
  });

  test('throws when a candidate is above 12 words', () => {
    const big = 'word '.repeat(15).trim();
    const raw = `<taglines>
<tagline>This candidate is a perfectly normal seven word tagline.</tagline>
<tagline>${big}</tagline>
<tagline>Another perfectly valid candidate seven words long here.</tagline>
</taglines>`;
    expect(() => parseOutput(raw)).toThrow(
      /candidate 2 word count 15 out of range/,
    );
  });
});
