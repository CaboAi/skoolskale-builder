// Vitest global setup. Inject fake env vars so modules that import @/lib/env
// don't fail validation when running in a test context without .env.local.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic';
process.env.GOOGLE_AI_API_KEY ??= 'test-google';
process.env.INNGEST_EVENT_KEY ??= 'test-event';
process.env.INNGEST_SIGNING_KEY ??= 'test-sign';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
process.env.TEAM_EMAIL_ALLOWLIST ??= 'test@example.com';
