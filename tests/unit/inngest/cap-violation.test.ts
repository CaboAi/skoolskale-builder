import { describe, expect, test } from 'vitest';
import {
  CapViolationError,
  buildCapRetryInstruction,
} from '@/lib/inngest/cap-violation';

describe('CapViolationError', () => {
  test('exposes structured fields and a human message', () => {
    const e = new CapViolationError({
      module: 'about_us',
      moduleLabel: 'About Us',
      actualChars: 1247,
      maxChars: 1050,
      rawOutput: 'snippet',
    });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CapViolationError);
    expect(e.name).toBe('CapViolationError');
    expect(e.module).toBe('about_us');
    expect(e.actualChars).toBe(1247);
    expect(e.maxChars).toBe(1050);
    expect(e.message).toBe('About Us is 1247 chars (cap: 1050)');
  });
});

describe('buildCapRetryInstruction', () => {
  const RAW = '<about_us_json>{"too":"long"}</about_us_json>';

  test('includes the previous attempt and the numeric guidance the model needs', () => {
    const msg = buildCapRetryInstruction({
      actualChars: 1247,
      maxChars: 1050,
      rawOutput: RAW,
    });
    expect(msg).toContain('<previous_attempt chars="1247">');
    expect(msg).toContain('That was 1247 characters');
    expect(msg).toContain('Cap is 1050');
    expect(msg).toContain('Keep the same structure');
    expect(msg).toContain('{"too":"long"}');
  });

  test('no-note path is byte-identical to the blunt-trim instruction (regression guard)', () => {
    const expected = `

<previous_attempt chars="1247">
${RAW}
</previous_attempt>

<retry_instruction>
That was 1247 characters. Cap is 1050. Rewrite tighter — cut whichever bucket or sentence is least essential. Keep the same structure.
</retry_instruction>`;
    // A blank/whitespace note must not change the no-note output either.
    expect(
      buildCapRetryInstruction({ actualChars: 1247, maxChars: 1050, rawOutput: RAW }),
    ).toBe(expected);
    expect(
      buildCapRetryInstruction({
        actualChars: 1247,
        maxChars: 1050,
        rawOutput: RAW,
        regenerateNote: '   ',
      }),
    ).toBe(expected);
  });

  test('with a length note: softens the directive and re-states the note as the last signal', () => {
    const msg = buildCapRetryInstruction({
      actualChars: 1247,
      maxChars: 1050,
      rawOutput: RAW,
      regenerateNote: 'make it longer',
    });
    // Softened directive: trim-to-fit, not cut-a-bucket.
    expect(msg).toContain('stay as close to the cap as possible');
    // Module-agnostic vocabulary: shared by about_us, welcome_dm, first-post.
    expect(msg).toContain('tighten existing sentences rather than removing sections');
    expect(msg).not.toContain('dropping a whole bucket');
    expect(msg).not.toContain('cut whichever bucket or sentence is least essential');
    // Cap-vs-note disambiguation: prevents "user feedback wins" from being
    // misread as overriding the cap on length-up notes like "much longer".
    expect(msg).toContain('the cap is the hard ceiling');
    expect(msg).toContain('1050-char cap');
    // The note is re-stated AFTER the trim directive so it stays weighted last.
    expect(msg).toContain('make it longer');
    expect(msg.indexOf('make it longer')).toBeGreaterThan(
      msg.indexOf('</retry_instruction>'),
    );
    // Note-text-independent ordering invariant: the priority-framed
    // suffix marker must follow </retry_instruction>. Locks the load-
    // bearing ordering even if future tests use a different note text.
    expect(msg.indexOf('USER FEEDBACK TO INCORPORATE')).toBeGreaterThan(
      msg.indexOf('</retry_instruction>'),
    );
  });
});
