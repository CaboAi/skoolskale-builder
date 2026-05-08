import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/calendar';

describe('calendar.parseOutput', () => {
  test('parses a valid title + description block', () => {
    const raw = `<calendar>
<title>Live Calls</title>
<description>Weekly Q&A on Thursdays at 11am PT. Replays posted same day.</description>
</calendar>`;
    const out = parseOutput(raw);
    expect(out.title).toBe('Live Calls');
    expect(out.description).toMatch(/Thursdays/);
  });

  test('throws when <calendar> wrapper is missing', () => {
    expect(() => parseOutput('hi')).toThrow(/missing <calendar>/);
  });

  test('throws when title exceeds 30 chars', () => {
    const longTitle = 'a'.repeat(31);
    const raw = `<calendar><title>${longTitle}</title><description>x</description></calendar>`;
    expect(() => parseOutput(raw)).toThrow(/title is 31 chars/);
  });

  test('throws when description exceeds 300 chars', () => {
    const longDesc = 'a'.repeat(301);
    const raw = `<calendar><title>Ok</title><description>${longDesc}</description></calendar>`;
    expect(() => parseOutput(raw)).toThrow(/description is 301 chars/);
  });
});
