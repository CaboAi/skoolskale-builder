/**
 * Password rules for the team login.
 *
 * Pure and free of `server-only` on purpose: the update-password client
 * component imports it, and keeping the rule in one place stops the form
 * and any future server-side check from drifting apart.
 *
 * MIN_PASSWORD_LENGTH must stay >= the "Minimum password length" setting in
 * Supabase Auth. If Supabase's is higher, sign-up succeeds here and fails
 * there with a confusing error.
 */
export const MIN_PASSWORD_LENGTH = 12;

export type PasswordProblem =
  | 'too-short'
  | 'mismatch'
  | 'empty-confirmation'
  | null;

/**
 * Returns the first problem with a new-password pair, or null if it passes.
 * Order matters: length is reported before mismatch so someone typing a
 * short password twice is told the useful thing.
 */
export function validateNewPassword(
  password: string,
  confirmation: string,
): PasswordProblem {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too-short';
  if (!confirmation) return 'empty-confirmation';
  if (password !== confirmation) return 'mismatch';
  return null;
}

export function passwordProblemMessage(problem: PasswordProblem): string | null {
  switch (problem) {
    case 'too-short':
      return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    case 'empty-confirmation':
      return 'Confirm your new password.';
    case 'mismatch':
      return 'Those two passwords don’t match.';
    case null:
      return null;
  }
}
