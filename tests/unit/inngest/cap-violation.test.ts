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
  test('includes the previous attempt and the numeric guidance the model needs', () => {
    const msg = buildCapRetryInstruction({
      actualChars: 1247,
      maxChars: 1050,
      rawOutput: '<about_us_json>{"too":"long"}</about_us_json>',
    });
    expect(msg).toContain('<previous_attempt chars="1247">');
    expect(msg).toContain('That was 1247 characters');
    expect(msg).toContain('Cap is 1050');
    expect(msg).toContain('Keep the same structure');
    expect(msg).toContain('{"too":"long"}');
  });
});
