import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/classroom';

describe('classroom.parseOutput', () => {
  test('parses one item with title + description', () => {
    const raw = `<classroom>
<item>
<title>The Welcome Course</title>
<description>Start here. Watch the first three modules in order; each one builds on the last.</description>
</item>
</classroom>`;
    const out = parseOutput(raw);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].title).toBe('The Welcome Course');
    expect(out.items[0].description).toMatch(/Start here/);
  });

  test('parses multiple items in order', () => {
    const raw = `<classroom>
<item><title>One</title><description>First desc.</description></item>
<item><title>Two</title><description>Second desc.</description></item>
<item><title>Three</title><description>Third desc.</description></item>
</classroom>`;
    const out = parseOutput(raw);
    expect(out.items.map((i) => i.title)).toEqual(['One', 'Two', 'Three']);
  });

  test('trims whitespace inside title and description tags', () => {
    const raw = `<classroom>
<item>
<title>  Spaced Out  </title>
<description>
  hello world
</description>
</item>
</classroom>`;
    const out = parseOutput(raw);
    expect(out.items[0].title).toBe('Spaced Out');
    expect(out.items[0].description).toBe('hello world');
  });

  test('throws when <classroom> wrapper is missing', () => {
    expect(() => parseOutput('just some text')).toThrow(/missing <classroom>/);
  });

  test('throws when no <item> tags are present', () => {
    expect(() => parseOutput('<classroom></classroom>')).toThrow(
      /no <item> tags/,
    );
  });

  test('throws when an item is missing <title>', () => {
    const raw = `<classroom><item><description>x</description></item></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/item 1 missing <title>/);
  });

  test('throws when an item is missing <description>', () => {
    const raw = `<classroom><item><title>x</title></item></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/item 1 missing <description>/);
  });

  test('throws when a title exceeds 50 chars', () => {
    const longTitle = 'a'.repeat(51);
    const raw = `<classroom><item><title>${longTitle}</title><description>x</description></item></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/item 1 title is 51 chars/);
  });

  test('throws when a description exceeds 500 chars', () => {
    const longDesc = 'a'.repeat(501);
    const raw = `<classroom><item><title>Ok</title><description>${longDesc}</description></item></classroom>`;
    expect(() => parseOutput(raw)).toThrow(/item 1 description is 501 chars/);
  });

  test('throws when more than 10 items are returned', () => {
    const item =
      '<item><title>t</title><description>d</description></item>';
    const raw = `<classroom>${item.repeat(11)}</classroom>`;
    expect(() => parseOutput(raw)).toThrow(/11 items returned/);
  });
});
