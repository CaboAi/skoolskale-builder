/**
 * Unit tests for src/lib/auth/auth-error.ts.
 *
 * The point of the code-to-copy mapping is that the sign-in page never
 * renders words that came in over the URL. The fallback case is the one that
 * matters most: a hand-crafted ?error= must not reach the page.
 */
import { describe, expect, test } from 'vitest';
import { AUTH_ERROR_CODES, authErrorMessage } from '@/lib/auth/auth-error';

const FABRICATED =
  'Your account was suspended. Call +1-555-0100 to restore access.';

describe('authErrorMessage', () => {
  test('shows nothing when there is no error parameter', () => {
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage(undefined)).toBeNull();
    expect(authErrorMessage('')).toBeNull();
  });

  test('returns copy for every code the routes can emit', () => {
    for (const code of AUTH_ERROR_CODES) {
      const message = authErrorMessage(code);
      expect(typeof message).toBe('string');
      expect(message!.length).toBeGreaterThan(0);
    }
  });

  test('gives each code its own distinct copy', () => {
    const messages = AUTH_ERROR_CODES.map(authErrorMessage);
    expect(new Set(messages).size).toBe(AUTH_ERROR_CODES.length);
  });

  test('tells the holder of a failed link what to do next', () => {
    expect(authErrorMessage('link_failed')).toContain('Request a new one');
  });

  test('never echoes attacker-supplied text back to the page', () => {
    expect(authErrorMessage(FABRICATED)).not.toContain('suspended');
    expect(authErrorMessage(FABRICATED)).not.toContain('555-0100');
  });

  test('collapses any unrecognised code to the same generic copy', () => {
    expect(authErrorMessage('nonsense')).toBe(authErrorMessage(FABRICATED));
  });
});
