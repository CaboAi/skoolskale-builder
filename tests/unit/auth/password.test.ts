/**
 * Unit tests for src/lib/auth/password.ts.
 *
 * The validator decides what the update-password form accepts. Its ordering
 * matters as much as its verdicts: someone who types a too-short password
 * into both fields should be told about the length, not the (non-existent)
 * mismatch.
 */
import { describe, expect, test } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  passwordProblemMessage,
  validateNewPassword,
} from '@/lib/auth/password';

const LONG_ENOUGH = 'a'.repeat(MIN_PASSWORD_LENGTH);
const TOO_SHORT = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);

describe('validateNewPassword', () => {
  test('accepts a matching pair at exactly the minimum length', () => {
    expect(validateNewPassword(LONG_ENOUGH, LONG_ENOUGH)).toBeNull();
  });

  test('accepts a matching pair longer than the minimum', () => {
    const longer = `${LONG_ENOUGH}extra`;
    expect(validateNewPassword(longer, longer)).toBeNull();
  });

  test('rejects a password one character below the minimum', () => {
    expect(validateNewPassword(TOO_SHORT, TOO_SHORT)).toBe('too-short');
  });

  test('rejects an empty password as too short rather than mismatched', () => {
    expect(validateNewPassword('', '')).toBe('too-short');
  });

  test('reports length before mismatch when both are wrong', () => {
    expect(validateNewPassword(TOO_SHORT, 'something-else-entirely')).toBe(
      'too-short',
    );
  });

  test('rejects a long-enough password with no confirmation typed', () => {
    expect(validateNewPassword(LONG_ENOUGH, '')).toBe('empty-confirmation');
  });

  test('rejects two long-enough passwords that differ', () => {
    expect(validateNewPassword(LONG_ENOUGH, `${LONG_ENOUGH}x`)).toBe(
      'mismatch',
    );
  });

  test('is case-sensitive when comparing the pair', () => {
    expect(validateNewPassword(LONG_ENOUGH, LONG_ENOUGH.toUpperCase())).toBe(
      'mismatch',
    );
  });
});

describe('passwordProblemMessage', () => {
  test('returns no message when there is no problem', () => {
    expect(passwordProblemMessage(null)).toBeNull();
  });

  test('names the configured minimum in the too-short message', () => {
    expect(passwordProblemMessage('too-short')).toBe(
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  });

  test('returns a distinct message for every problem it can be given', () => {
    const messages = (['too-short', 'empty-confirmation', 'mismatch'] as const)
      .map(passwordProblemMessage);

    expect(messages.every((m) => typeof m === 'string' && m.length > 0)).toBe(
      true,
    );
    expect(new Set(messages).size).toBe(messages.length);
  });
});
