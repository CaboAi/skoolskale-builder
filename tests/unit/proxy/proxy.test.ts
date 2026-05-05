/**
 * Unit tests for src/proxy.ts middleware.
 *
 * The proxy gates DEMO_MODE: when on, unauthenticated requests are routed
 * through mintDemoSession; when off, they're redirected to /auth/login.
 *
 * @/lib/env, @/lib/supabase/demo-session, and @supabase/ssr are mocked at
 * module level so we can drive DEMO_MODE and the user-fetch result
 * independently of process.env or the real Supabase SDK.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const envState: { DEMO_MODE: boolean } = { DEMO_MODE: false };
const getUserMock = vi.fn();
const mintDemoSessionMock = vi.fn();

vi.mock('@/lib/env', () => ({
  get env() {
    return {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      DEMO_MODE: envState.DEMO_MODE,
    };
  },
}));

vi.mock('@/lib/supabase/demo-session', () => ({
  mintDemoSession: (...args: unknown[]) => mintDemoSessionMock(...args),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

beforeEach(() => {
  envState.DEMO_MODE = false;
  getUserMock.mockReset();
  mintDemoSessionMock.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`));
}

describe('proxy middleware — DEMO_MODE gating', () => {
  test('redirects unauthenticated request to /auth/login when DEMO_MODE is off', async () => {
    envState.DEMO_MODE = false;
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/some-page'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?next=%2Fsome-page',
    );
    expect(mintDemoSessionMock).not.toHaveBeenCalled();
  });

  test('calls mintDemoSession for unauthenticated request when DEMO_MODE is on', async () => {
    envState.DEMO_MODE = true;
    getUserMock.mockResolvedValue({ data: { user: null } });
    const sentinel = NextResponse.next();
    mintDemoSessionMock.mockReturnValue(sentinel);

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/some-page'));

    expect(response).toBe(sentinel);
    expect(mintDemoSessionMock).toHaveBeenCalledTimes(1);
  });

  test('passes through authenticated request without invoking demo path', async () => {
    envState.DEMO_MODE = true;
    getUserMock.mockResolvedValue({
      data: { user: { id: 'real-user', email: 'real@example.com' } },
    });

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/some-page'));

    expect(response.headers.get('location')).toBeNull();
    expect(mintDemoSessionMock).not.toHaveBeenCalled();
  });
});
