/**
 * Unit tests for src/app/auth/confirm/route.ts.
 *
 * This route exists because /auth/callback's PKCE exchange only completes in
 * the browser that started the flow. Verifying a token_hash works anywhere,
 * which is what makes a reset link opened on a phone usable. The allowlist
 * still applies, and `next` is still constrained to this origin.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

// All factory-captured state hoisted per-file. See CLAUDE.md
// § "Mocking conventions".
const { envState, verifyOtpMock, getUserMock, signOutMock } = vi.hoisted(
  () => ({
    envState: { TEAM_EMAIL_ALLOWLIST: [] as string[] },
    verifyOtpMock: vi.fn(),
    getUserMock: vi.fn(),
    signOutMock: vi.fn(),
  }),
);

vi.mock('@/lib/env', () => ({
  get env() {
    return { TEAM_EMAIL_ALLOWLIST: envState.TEAM_EMAIL_ALLOWLIST };
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: verifyOtpMock,
      getUser: getUserMock,
      signOut: signOutMock,
    },
  }),
}));

const TEAM_MEMBER_EMAIL = 'mario@skoolskale.com';
const OUTSIDER_EMAIL = 'stranger@example.com';
const TOKEN = 'a-token-hash';

function makeRequest(query: string): NextRequest {
  return new NextRequest(new URL(`https://preskool.io/auth/confirm?${query}`));
}

async function callRoute(query: string) {
  const { GET } = await import('@/app/auth/confirm/route');
  return GET(makeRequest(query));
}

beforeEach(() => {
  envState.TEAM_EMAIL_ALLOWLIST = [TEAM_MEMBER_EMAIL];
  verifyOtpMock.mockReset();
  verifyOtpMock.mockResolvedValue({ error: null });
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-1', email: TEAM_MEMBER_EMAIL } },
  });
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
});

describe('GET /auth/confirm', () => {
  test('verifies the token hash with the type from the link', async () => {
    await callRoute(`token_hash=${TOKEN}&type=recovery`);

    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: TOKEN,
      type: 'recovery',
    });
  });

  test('sends a verified team member to the requested page', async () => {
    const response = await callRoute(
      `token_hash=${TOKEN}&type=recovery&next=%2Fauth%2Fupdate-password`,
    );

    expect(response.headers.get('location')).toBe(
      'https://preskool.io/auth/update-password',
    );
  });

  test('defaults to the root when the link carries no next', async () => {
    const response = await callRoute(`token_hash=${TOKEN}&type=magiclink`);

    expect(response.headers.get('location')).toBe('https://preskool.io/');
  });

  test('refuses to forward to an absolute next pointing off-site', async () => {
    const response = await callRoute(
      `token_hash=${TOKEN}&type=recovery&next=https%3A%2F%2Fevil.example.com`,
    );

    expect(response.headers.get('location')).toBe('https://preskool.io/');
  });

  test('rejects a link with no token hash', async () => {
    const response = await callRoute('type=recovery');

    expect(response.headers.get('location')).toContain('/auth/login?error=');
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  test('rejects a link whose type is not an email OTP type', async () => {
    const response = await callRoute(`token_hash=${TOKEN}&type=not-a-real-type`);

    expect(response.headers.get('location')).toContain('/auth/login?error=');
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  test('surfaces an expired-link error back on the login page', async () => {
    verifyOtpMock.mockResolvedValue({
      error: { message: 'Email link is invalid or has expired' },
    });

    const response = await callRoute(`token_hash=${TOKEN}&type=recovery`);

    expect(response.headers.get('location')).toContain(
      'error=Email+link+is+invalid+or+has+expired',
    );
  });

  test('turns away a verified user who is not on the allowlist', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'outsider', email: OUTSIDER_EMAIL } },
    });

    const response = await callRoute(`token_hash=${TOKEN}&type=recovery`);

    expect(response.headers.get('location')).toBe(
      'https://preskool.io/auth/not-allowed',
    );
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
