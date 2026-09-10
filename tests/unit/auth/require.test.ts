/**
 * Unit tests for src/lib/auth/require.ts.
 *
 * requireUser is the server-side gate every Server Component and Route
 * Handler funnels through. Besides "is there a session", it re-checks
 * TEAM_EMAIL_ALLOWLIST on every call, because /auth/callback only sees
 * magic-link sign-ins — a password session never passes through it.
 *
 * next/navigation, @/lib/supabase/server and @/lib/env are mocked at module
 * level. The redirect mock throws, mirroring the real redirect()'s
 * control-flow-by-exception, so we can assert the function does not fall
 * through to returning a user it should have rejected.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// All factory-captured state hoisted per-file. See CLAUDE.md
// § "Mocking conventions".
const TEAM_MEMBER_EMAIL = 'ramsha@skoolskale.com';
const OUTSIDER_EMAIL = 'stranger@example.com';

const { envState, getUserMock, signOutMock, redirectMock } = vi.hoisted(() => ({
  envState: { TEAM_EMAIL_ALLOWLIST: [] as string[] },
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('@/lib/env', () => ({
  get env() {
    return { TEAM_EMAIL_ALLOWLIST: envState.TEAM_EMAIL_ALLOWLIST };
  },
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock, signOut: signOutMock },
  }),
}));

function mockSession(email: string | null) {
  getUserMock.mockResolvedValue({
    data: { user: email === null ? null : { id: 'user-1', email } },
  });
}

beforeEach(() => {
  envState.TEAM_EMAIL_ALLOWLIST = [TEAM_MEMBER_EMAIL];
  getUserMock.mockReset();
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  redirectMock.mockClear();
});

afterEach(() => {
  vi.resetModules();
});

describe('requireUser', () => {
  test('returns the user when their email is on the allowlist', async () => {
    mockSession(TEAM_MEMBER_EMAIL);

    const { requireUser } = await import('@/lib/auth/require');

    await expect(requireUser()).resolves.toEqual({
      id: 'user-1',
      email: TEAM_MEMBER_EMAIL,
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  test('matches the allowlist case-insensitively', async () => {
    mockSession(TEAM_MEMBER_EMAIL.toUpperCase());

    const { requireUser } = await import('@/lib/auth/require');

    await expect(requireUser()).resolves.toEqual({
      id: 'user-1',
      email: TEAM_MEMBER_EMAIL.toUpperCase(),
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  test('redirects to /auth/login when there is no session', async () => {
    mockSession(null);

    const { requireUser } = await import('@/lib/auth/require');

    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT:/auth/login');
    expect(signOutMock).not.toHaveBeenCalled();
  });

  test('redirects a session whose email is not on the allowlist to /auth/not-allowed', async () => {
    mockSession(OUTSIDER_EMAIL);

    const { requireUser } = await import('@/lib/auth/require');

    await expect(requireUser()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/not-allowed',
    );
  });

  test('revokes the session of a user who is not on the allowlist', async () => {
    mockSession(OUTSIDER_EMAIL);

    const { requireUser } = await import('@/lib/auth/require');

    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT');
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  test('rejects a session whose user record carries no email', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: undefined } },
    });

    const { requireUser } = await import('@/lib/auth/require');

    await expect(requireUser()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/not-allowed',
    );
  });

  test('locks out a user removed from the allowlist mid-session', async () => {
    mockSession(TEAM_MEMBER_EMAIL);
    envState.TEAM_EMAIL_ALLOWLIST = [];

    const { requireUser } = await import('@/lib/auth/require');

    await expect(requireUser()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/not-allowed',
    );
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});

describe('requireAdmin', () => {
  test('returns the user when they are allowlisted and hold the admin role', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: TEAM_MEMBER_EMAIL,
          app_metadata: { role: 'admin' },
        },
      },
    });

    const { requireAdmin } = await import('@/lib/auth/require');

    await expect(requireAdmin()).resolves.toMatchObject({ id: 'user-1' });
  });

  test('throws 403 for an allowlisted user without the admin role', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: TEAM_MEMBER_EMAIL,
          app_metadata: { role: 'va' },
        },
      },
    });

    const { requireAdmin } = await import('@/lib/auth/require');

    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  test('rejects a non-allowlisted admin before the role check runs', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: OUTSIDER_EMAIL,
          app_metadata: { role: 'admin' },
        },
      },
    });

    const { requireAdmin } = await import('@/lib/auth/require');

    await expect(requireAdmin()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/not-allowed',
    );
  });
});
