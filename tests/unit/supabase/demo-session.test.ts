/**
 * Unit tests for src/lib/supabase/demo-session.ts.
 *
 * mintDemoSession should early-return the original response when DEMO_MODE
 * is off, and mint a fresh session via generateLink + verifyOtp when on.
 *
 * Failure-path branches (generateLink error, verifyOtp error, thrown
 * exceptions) are defensive logging and not exercised here — the behavior
 * is "log and return the original response", which is structurally
 * equivalent to the DEMO_MODE-off branch already under test.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const envState: {
  DEMO_MODE: boolean;
  DEMO_USER_EMAIL: string | undefined;
} = {
  DEMO_MODE: false,
  DEMO_USER_EMAIL: 'demo@skoolskale.app',
};

const generateLinkMock = vi.fn();
const verifyOtpMock = vi.fn();

vi.mock('@/lib/env', () => ({
  get env() {
    return {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      DEMO_MODE: envState.DEMO_MODE,
      DEMO_USER_EMAIL: envState.DEMO_USER_EMAIL,
    };
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { generateLink: generateLinkMock } },
  }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { verifyOtp: verifyOtpMock },
  }),
}));

beforeEach(() => {
  envState.DEMO_MODE = false;
  envState.DEMO_USER_EMAIL = 'demo@skoolskale.app';
  generateLinkMock.mockReset();
  verifyOtpMock.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

function makeRequest(): NextRequest {
  return new NextRequest(new URL('http://localhost/some-page'));
}

describe('mintDemoSession', () => {
  test('returns the original response unchanged when DEMO_MODE is off', async () => {
    envState.DEMO_MODE = false;
    const inputResponse = NextResponse.next();

    const { mintDemoSession } = await import('@/lib/supabase/demo-session');
    const result = await mintDemoSession(makeRequest(), inputResponse);

    expect(result).toBe(inputResponse);
    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  test('mints a session and returns a new response when DEMO_MODE is on', async () => {
    envState.DEMO_MODE = true;
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: 'tok-abc' } },
      error: null,
    });
    verifyOtpMock.mockResolvedValue({ error: null });
    const inputResponse = NextResponse.next();

    const { mintDemoSession } = await import('@/lib/supabase/demo-session');
    const result = await mintDemoSession(makeRequest(), inputResponse);

    expect(generateLinkMock).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'demo@skoolskale.app',
    });
    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: 'tok-abc',
      type: 'magiclink',
    });
    expect(result).not.toBe(inputResponse);
  });
});
