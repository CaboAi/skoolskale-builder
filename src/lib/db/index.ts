import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

// Long-lived connection pool. In serverless contexts (Vercel), postgres-js
// handles reuse across invocations; keep max low for Supabase direct conn.
const client = postgres(env.DATABASE_URL, {
  max: 10,
  prepare: false,
});

export const db = drizzle(client, { schema });

export type Db = typeof db;
export { schema };
