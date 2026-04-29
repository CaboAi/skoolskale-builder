import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Mints a real Supabase session for the hard-coded demo user and writes
 * the sb-* cookies onto the passed NextResponse so the browser is logged
 * in starting on the next request.
 *
 * Flow:
 *   1. Service-role client calls auth.admin.generateLink({type:'magiclink'})
 *      to obtain a hashed token without sending an email.
 *   2. An SSR client (anon key) verifies that token via verifyOtp, which
 *      runs the same code path as /auth/callback and writes the sb-*
 *      session cookies via the cookies.setAll callback.
 *
 * On any failure we log and return the original response unchanged —
 * middleware must NEVER 500 for the demo user.
 */
export async function mintDemoSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  if (!env.DEMO_MODE || !env.DEMO_USER_EMAIL) {
    return response;
  }

  try {
    const admin = createSupabaseClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: env.DEMO_USER_EMAIL,
    });
    if (error) {
      console.error('[demo-session] generateLink failed:', error.message);
      return response;
    }
    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) {
      console.error('[demo-session] no hashed_token in generateLink response');
      return response;
    }

    // Build a fresh response object whose Set-Cookie headers we can
    // forward onto the caller's response. We use the @supabase/ssr
    // server client so the cookies.setAll callback gets called by
    // verifyOtp and writes sb-* cookies in the format the browser +
    // middleware expect.
    let mintedResponse = NextResponse.next({ request });
    const ssr = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            mintedResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              mintedResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { error: verifyErr } = await ssr.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });
    if (verifyErr) {
      console.error('[demo-session] verifyOtp failed:', verifyErr.message);
      return response;
    }

    // mintedResponse now carries the freshly-set sb-* cookies.
    return mintedResponse;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[demo-session] unexpected error:', msg);
    return response;
  }
}
