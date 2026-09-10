import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail } from '@/lib/auth/allowlist';

/**
 * Cross-device email link handler.
 *
 * /auth/callback exchanges a PKCE `code`, which only works in the same
 * browser that started the flow: the code verifier lives in a cookie there.
 * Request a reset on a laptop, open the mail on a phone, and the exchange
 * fails with "code challenge does not match previously saved code verifier".
 *
 * Verifying a `token_hash` instead needs nothing stored locally, so the link
 * works wherever it is opened. Supabase email templates have to point here
 * rather than at {{ .ConfirmationURL }} — see docs/auth-email-templates.md.
 *
 * /auth/callback stays for the PKCE flows that still use it.
 */

const ALLOWED_TYPES: EmailOtpType[] = [
  'recovery',
  'magiclink',
  'email',
  'invite',
  'signup',
  'email_change',
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (ALLOWED_TYPES as string[]).includes(value);
}

function loginWithError(origin: string, message: string) {
  const redirect = new URL('/auth/login', origin);
  redirect.searchParams.set('error', message);
  return NextResponse.redirect(redirect);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') ?? '/';

  if (!tokenHash || !isEmailOtpType(type)) {
    return loginWithError(url.origin, 'That link is not valid. Request a new one.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return loginWithError(url.origin, error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/auth/not-allowed', url.origin));
  }

  // Only ever bounce somewhere inside this app. An absolute `next` would let
  // a crafted link carry a freshly-authenticated visitor off-site.
  const safeNext = next.startsWith('/') ? next : '/';
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
