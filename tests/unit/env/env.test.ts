/**
 * Schema tests for src/lib/env.ts.
 *
 * env.ts runs validation at import time (`export const env = validate()`),
 * so each test sets process.env to a known-good baseline plus the test's
 * own DEMO_MODE / VERCEL_ENV overrides, resets the module cache, and
 * re-imports to trigger a fresh validate() call.
 *
 * We do NOT rely on tests/setup.ts for baseline values — its `??=` pattern
 * is defeated by parent-process env vars set to empty strings (Claude Code
 * clears ANTHROPIC_API_KEY for security, for example), so this file owns
 * its own complete baseline.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const BASELINE: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  ANTHROPIC_API_KEY: 'test-anthropic',
  GOOGLE_AI_API_KEY: 'test-google',
  INNGEST_EVENT_KEY: 'test-event',
  INNGEST_SIGNING_KEY: 'test-sign',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  TEAM_EMAIL_ALLOWLIST: 'test@example.com',
};

const MUTATED_KEYS = [
  ...Object.keys(BASELINE),
  'DEMO_MODE',
  'DEMO_USER_EMAIL',
  'DEMO_USER_ID',
  'VERCEL_ENV',
] as const;

const VALID_DEMO_EMAIL = 'demo@skoolskale.app';
const VALID_DEMO_UUID = '1842cd82-3441-4595-ac7a-7becb2618481';

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of MUTATED_KEYS) {
    originalEnv[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(BASELINE)) {
    process.env[key] = value;
  }
  delete process.env.DEMO_MODE;
  delete process.env.DEMO_USER_EMAIL;
  delete process.env.DEMO_USER_ID;
  delete process.env.VERCEL_ENV;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const key of MUTATED_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  vi.restoreAllMocks();
});

async function loadEnv() {
  vi.resetModules();
  return import('@/lib/env');
}

describe('env schema — DEMO_MODE production gate', () => {
  test('rejects DEMO_MODE truthy when VERCEL_ENV=production', async () => {
    process.env.DEMO_MODE = '1';
    process.env.DEMO_USER_EMAIL = VALID_DEMO_EMAIL;
    process.env.DEMO_USER_ID = VALID_DEMO_UUID;
    process.env.VERCEL_ENV = 'production';

    await expect(loadEnv()).rejects.toThrow('Invalid environment variables');

    const errorCall = (console.error as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    const fieldErrors = errorCall?.[1] as Record<string, string[]> | undefined;
    expect(fieldErrors?.DEMO_MODE?.[0]).toContain(
      'DEMO_MODE must not be truthy when VERCEL_ENV=production',
    );
  });

  test('accepts DEMO_MODE truthy when VERCEL_ENV=preview with email + uuid', async () => {
    process.env.DEMO_MODE = '1';
    process.env.DEMO_USER_EMAIL = VALID_DEMO_EMAIL;
    process.env.DEMO_USER_ID = VALID_DEMO_UUID;
    process.env.VERCEL_ENV = 'preview';

    const { env } = await loadEnv();
    expect(env.DEMO_MODE).toBe(true);
  });

  test('accepts DEMO_MODE truthy when VERCEL_ENV=development with email + uuid', async () => {
    process.env.DEMO_MODE = '1';
    process.env.DEMO_USER_EMAIL = VALID_DEMO_EMAIL;
    process.env.DEMO_USER_ID = VALID_DEMO_UUID;
    process.env.VERCEL_ENV = 'development';

    const { env } = await loadEnv();
    expect(env.DEMO_MODE).toBe(true);
  });

  test('rejects DEMO_MODE truthy when DEMO_USER_EMAIL is missing', async () => {
    process.env.DEMO_MODE = '1';
    process.env.DEMO_USER_ID = VALID_DEMO_UUID;
    process.env.VERCEL_ENV = 'preview';

    await expect(loadEnv()).rejects.toThrow('Invalid environment variables');
  });

  test.each([
    ['production'],
    ['preview'],
    ['development'],
    [undefined],
  ])('accepts DEMO_MODE=0 when VERCEL_ENV=%s', async (vercelEnv) => {
    process.env.DEMO_MODE = '0';
    if (vercelEnv) process.env.VERCEL_ENV = vercelEnv;

    const { env } = await loadEnv();
    expect(env.DEMO_MODE).toBe(false);
  });

  test('accepts unset DEMO_MODE', async () => {
    const { env } = await loadEnv();
    expect(env.DEMO_MODE).toBe(false);
  });
});
