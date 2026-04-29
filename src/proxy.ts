import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Root middleware:
 *   1. Refreshes the Supabase session on every request (required for SSR auth).
 *   2. Redirects unauthenticated users to /auth/login (except for /auth/* and static assets).
 *
 * Allowlist enforcement happens in /auth/callback (see route.ts) at the moment
 * the session is first established — if we did it here, every request would
 * have to re-fetch the user and re-validate, which is wasteful.
 */

const PUBLIC_PATHS = ['/auth/login', '/auth/callback', '/auth/not-allowed'];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Next internals + Vercel analytics + favicon + api/inngest webhook etc.
  // Adjust as needed — generators probably want to stay gated.
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/api/inngest')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: refreshes cookies. Must be called before any redirect logic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // DEMO BYPASS: auth check disabled for Monday demo with Skool Skale.
  // Re-enable after demo by uncommenting the block below.
  // if (!user && !isPublic(pathname)) {
  //   const loginUrl = request.nextUrl.clone();
  //   loginUrl.pathname = '/auth/login';
  //   loginUrl.searchParams.set('next', pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  return response;
}

export const config = {
  // Skip Next static assets and image optimizer.
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};