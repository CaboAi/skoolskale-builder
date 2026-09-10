/**
 * Reasons an email link can fail, and what to tell the person holding it.
 *
 * The auth routes redirect failures to /auth/login with one of these codes
 * rather than the raw provider message. Two reasons:
 *
 *   - A query parameter rendered onto the sign-in page is text an attacker
 *     controls. React escapes it, so this is not XSS, but "Your account is
 *     suspended, contact security@…" on a real login page is a workable
 *     phishing lure. A fixed set of codes cannot carry an attacker's words.
 *   - Supabase's own strings ("Email link is invalid or has expired") leak
 *     implementation detail and do not say what to do next.
 *
 * Pure and free of `server-only`: the login form imports it too.
 */
export const AUTH_ERROR_CODES = ['invalid_link', 'link_failed'] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_link:
    'That sign-in link is incomplete. Request a new one below.',
  // Covers expired, already used, and revoked. Supabase does not reliably
  // distinguish them, and the action is the same in every case.
  link_failed:
    'That link didn’t work. It may have expired or already been used. Request a new one below.',
};

const FALLBACK = 'Something went wrong with that link. Try again below.';

function isAuthErrorCode(value: string): value is AuthErrorCode {
  return (AUTH_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Maps a ?error= value to display copy. Anything unrecognised — including a
 * hand-crafted value — collapses to the generic fallback.
 */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return isAuthErrorCode(code) ? MESSAGES[code] : FALLBACK;
}
