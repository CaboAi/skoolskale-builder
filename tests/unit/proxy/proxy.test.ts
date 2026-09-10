/**
 * Unit tests for src/proxy.ts middleware.
 *
 * The proxy gates DEMO_MODE: when on, unauthenticated requests are routed
 * through mintDemoSession; when off, they're redirected to /auth/login. It
 * also enforces TEAM_EMAIL_ALLOWLIST on every authenticated request, which is
 * the gate that password sign-in relies on (it never hits /auth/callback).
 *
 * @/lib/env, @/lib/supabase/demo-session, and @supabase/ssr are mocked at
 * module level so we can drive DEMO_MODE and the user-fetch result
 * independently of process.env or the real Supabase SDK.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// All factory-captured state hoisted per-file. See CLAUDE.md
// § "Mocking conventions".
const TEAM_MEMBER_EMAIL = 'real@example.com';
const OUTSIDER_EMAIL = 'stranger@example.com';

const { envState, getUserMock, signOutMock, mintDemoSessionMock } = vi.hoisted(
  () => ({
    envState: {
      DEMO_MODE: false,
      TEAM_EMAIL_ALLOWLIST: ['real@example.com'] as string[],
    },
    getUserMock: vi.fn(),
    signOutMock: vi.fn(),
    mintDemoSessionMock: vi.fn(),
  }),
);

vi.mock('@/lib/env', () => ({
  get env() {
    return {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      DEMO_MODE: envState.DEMO_MODE,
      TEAM_EMAIL_ALLOWLIST: envState.TEAM_EMAIL_ALLOWLIST,
    };
  },
}));

vi.mock('@/lib/supabase/demo-session', () => ({
  mintDemoSession: (...args: unknown[]) => mintDemoSessionMock(...args),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock, signOut: signOutMock },
  }),
}));

beforeEach(() => {
  envState.DEMO_MODE = false;
  envState.TEAM_EMAIL_ALLOWLIST = [TEAM_MEMBER_EMAIL];
  getUserMock.mockReset();
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
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
      data: { user: { id: 'real-user', email: TEAM_MEMBER_EMAIL } },
    });

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/some-page'));

    expect(response.headers.get('location')).toBeNull();
    expect(mintDemoSessionMock).not.toHaveBeenCalled();
  });
});

describe('proxy middleware — allowlist enforcement', () => {
  test('redirects an authenticated non-allowlisted user to /auth/not-allowed', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'outsider', email: OUTSIDER_EMAIL } },
    });

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/some-page'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/not-allowed',
    );
  });

  test('revokes the session of an authenticated non-allowlisted user', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'outsider', email: OUTSIDER_EMAIL } },
    });

    const { proxy } = await import('@/proxy');
    await proxy(makeRequest('/some-page'));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  test('lets a non-allowlisted user reach /auth/not-allowed without redirecting again', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'outsider', email: OUTSIDER_EMAIL } },
    });

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/auth/not-allowed'));

    expect(response.headers.get('location')).toBeNull();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  test('matches allowlist entries case-insensitively', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'real-user', email: TEAM_MEMBER_EMAIL.toUpperCase() } },
    });

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/some-page'));

    expect(response.headers.get('location')).toBeNull();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  test('locks out a user removed from the allowlist mid-session', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'real-user', email: TEAM_MEMBER_EMAIL } },
    });
    envState.TEAM_EMAIL_ALLOWLIST = [];

    const { proxy } = await import('@/proxy');
    const response = await proxy(makeRequest('/some-page'));

    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/not-allowed',
    );
  });
});
