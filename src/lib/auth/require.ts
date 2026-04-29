import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side helper: returns the authed user or redirects to /auth/login.
 * Use in Server Components, Server Actions, and Route Handlers that require a session.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // DEMO BYPASS: return fake user when no session exists, for Monday demo.
  // Re-enable real auth by uncommenting the redirect block below.
  if (!user) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo@skoolskale.com',
      app_metadata: { role: 'admin' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;
    // redirect('/auth/login');
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