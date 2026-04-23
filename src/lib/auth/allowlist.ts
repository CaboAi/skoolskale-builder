import 'server-only';
import { env } from '@/lib/env';

/**
 * Case-insensitive check against env.TEAM_EMAIL_ALLOWLIST.
 * The allowlist is already split + lowercased by the env validator
 * (see src/lib/env.ts), so we only need to normalize the input here.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return env.TEAM_EMAIL_ALLOWLIST.includes(normalized);
}
