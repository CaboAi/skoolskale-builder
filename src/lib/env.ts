/**
 * Environment variable validator.
 * Runs at import time — fails loud if anything is missing or malformed.
 * Import this once at the top of any server entrypoint.
 */
import { z } from 'zod';

const serverSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Postgres (Drizzle)
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // AI providers
  ANTHROPIC_API_KEY: z.string().min(1),
  GOOGLE_AI_API_KEY: z.string().min(1),

  // Inngest
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  TEAM_EMAIL_ALLOWLIST: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((e) => e.trim().toLowerCase())),

  // Deferred (optional for now)
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  CANVA_CLIENT_ID: z.string().optional(),
  CANVA_CLIENT_SECRET: z.string().optional(),
  CANVA_REDIRECT_URI: z.string().url().optional(),
});

function validate() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}

export const env = validate();

export type Env = z.infer<typeof serverSchema>;

// Run validation standalone: `pnpm tsx src/lib/env.ts`
if (require.main === module) {
  console.log('✅ Environment variables valid');
  console.log(`   Team allowlist: ${env.TEAM_EMAIL_ALLOWLIST.length} emails`);
}
