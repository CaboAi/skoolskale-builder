import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail } from '@/lib/auth/allowlist';

/**
 * Magic-link callback:
 *   1. Exchange ?code= for a session.
 *   2. Check the authed user's email against the allowlist.
 *   3. If not allowed, sign them out and send to /auth/not-allowed.
 *   4. Else redirect to ?next= (default '/').
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login', url.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    // Most often this is the PKCE code verifier missing because the link was
    // opened in a different browser than the one that requested it. See
    // /auth/confirm, which is not subject to that. Raw message stays in the
    // log rather than on the sign-in page — see @/lib/auth/auth-error.
    console.error('[auth/callback] exchange failed:', exchangeError.message);
    const redir = new URL('/auth/login', url.origin);
    redir.searchParams.set('error', 'link_failed');
    return NextResponse.redirect(redir);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/auth/not-allowed', url.origin));
  }

  const safeNext = next.startsWith('/') ? next : '/';
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
