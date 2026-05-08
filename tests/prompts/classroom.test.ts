import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/classroom';

describe('classroom.parseOutput', () => {
  test('parses a valid title + description block', () => {
    const raw = `<classroom>
<title>The Welcome Course</title>
<description>Start here. Watch the first three modules in order; each one builds on the last.</description>
</classroom>`;
    const out = parseOutput(raw);
    expect(out.title).toBe('The Welcome Course');
    expect(out.description).toMatch(/Start here/);
  });

  test('trims surrounding whitespace inside the tags', () => {
    const raw = `<classroom>
<title>  Spaced Out  </title>
<description>
  hello world
</description>
</classroom>`;
    const out = parseOutput(raw);
    expect(out.title).toBe('Spaced Out');
    expect(out.description).toBe('hello world');
  });

  test('throws when <classroom> wrapper is missing', () => {
    expect(() => parseOutput('just some text')).toThrow(/missing <classroom>/);
  });

  test('throws when <title> tag is missing', () => {
    const raw = `<classroom><description>x</description></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/missing <title>/);
  });

  test('throws when <description> tag is missing', () => {
    const raw = `<classroom><title>x</title></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/missing <description>/);
  });

  test('throws when title exceeds 50 chars', () => {
    const longTitle = 'a'.repeat(51);
    const raw = `<classroom><title>${longTitle}</title><description>x</description></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/title is 51 chars/);
  });

  test('throws when description exceeds 500 chars', () => {
    const longDesc = 'a'.repeat(501);
    const raw = `<classroom><title>Ok</title><description>${longDesc}</description></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/description is 501 chars/);
  });
});
