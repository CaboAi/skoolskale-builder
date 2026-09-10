import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail } from './allowlist';

/**
 * Server-side helper: returns the authed user or redirects to /auth/login.
 * Use in Server Components, Server Actions, and Route Handlers that require a session.
 *
 * Also re-checks the team allowlist on every call. /auth/callback validates
 * the allowlist when a magic-link session is first minted, but that is not
 * the only way a session can come into existence — password sign-in (and any
 * future provider) never touches that route. Checking here means the gate
 * holds regardless of how the session was established, and revoking someone
 * is a matter of removing them from TEAM_EMAIL_ALLOWLIST rather than hunting
 * down every entry point. src/proxy.ts enforces the same rule at the request
 * boundary; this is the defence-in-depth layer for anything its matcher skips.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (!isAllowedEmail(user.email)) {
    // Revokes the refresh token server-side. The cookie clear is best-effort:
    // called from a Server Component, createClient's setAll is a no-op (it
    // cannot write cookies during render). That is fine — the stale cookie
    // grants nothing, because this check runs again on the next request.
    await supabase.auth.signOut();
    redirect('/auth/not-allowed');
  }

  return user;
}

/**
 * Server-side helper: returns the authed user if they have admin role,
 * else throws Response-like 403. Role is read from
 * auth.jwt() ->> 'role' (CLAUDE.md convention) via user.app_metadata.role
 * or user.user_metadata.role fallback.
 *
 * For Route Handlers, wrap the call and convert the thrown Response into
 * a NextResponse, or handle with try/catch. For Server Components, this will
 * bubble up and Next will render the nearest error boundary.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  const role =
    (user.app_metadata?.role as string | undefined) ??
    (user.user_metadata?.role as string | undefined);
  if (role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
  return user;
}
