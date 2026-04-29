/**
 * Idempotent demo user seeder.
 *
 * Creates (or updates) a Supabase auth.users row for the hard-coded demo
 * account used by DEMO_MODE. Re-running is safe: if the user already exists
 * with the right email, we just ensure app_metadata.role = 'admin'.
 *
 * Usage:
 *   pnpm dlx dotenv-cli -e .env.local -- pnpm demo:seed
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *               DEMO_USER_EMAIL, DEMO_USER_ID
 *
 * Hard-coded UUID convention (paste into Vercel env if accepted):
 *   1842cd82-3441-4595-ac7a-7becb2618481
 *
 * Path: uses AdminUserAttributes.id (Supabase v2 supports custom ids on
 * createUser). If that ever stops working we'll fall back to a direct
 * INSERT into auth.users via the postgres superuser connection.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
type AdminApi = SupabaseClient['auth']['admin'];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL;
const DEMO_ID = process.env.DEMO_USER_ID;

function requireVar(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`[seed-demo-user] missing env var ${name}`);
    process.exit(1);
  }
  return value;
}

async function findUserByEmail(
  admin: AdminApi,
  email: string,
): Promise<User | null> {
  // listUsers paginates; for a small project (< 1000 users) the first page
  // is sufficient. If we ever exceed that, switch to filter-by-email when
  // the supabase JS API exposes it.
  const { data, error } = await admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    throw new Error(`listUsers failed: ${error.message}`);
  }
  const lower = email.toLowerCase();
  const match = data.users.find(
    (u) => u.email && u.email.toLowerCase() === lower,
  );
  return match ?? null;
}

async function main() {
  const url = requireVar('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  const key = requireVar('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  const email = requireVar('DEMO_USER_EMAIL', DEMO_EMAIL);
  const id = requireVar('DEMO_USER_ID', DEMO_ID);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = supabase.auth.admin;

  console.log(`[seed-demo-user] target email: ${email}`);
  console.log(`[seed-demo-user] target id:    ${id}`);

  const existing = await findUserByEmail(admin, email);

  if (existing) {
    console.log(`[seed-demo-user] user exists (id=${existing.id})`);
    if (existing.id !== id) {
      console.warn(
        `[seed-demo-user] WARNING: existing user id (${existing.id}) does not match DEMO_USER_ID (${id})`,
      );
      console.warn(
        '[seed-demo-user] update DEMO_USER_ID in .env.local + Vercel to the existing id.',
      );
    }
    const role =
      (existing.app_metadata as Record<string, unknown> | null)?.role;
    if (role !== 'admin') {
      console.log("[seed-demo-user] user missing app_metadata.role='admin'; updating");
      const { error: updErr } = await admin.updateUserById(existing.id, {
        app_metadata: { ...(existing.app_metadata ?? {}), role: 'admin' },
      });
      if (updErr) {
        throw new Error(`updateUserById failed: ${updErr.message}`);
      }
      console.log('[seed-demo-user] role updated');
    } else {
      console.log("[seed-demo-user] app_metadata.role='admin' already set");
    }
    console.log('[seed-demo-user] OK (idempotent no-op or role-fix).');
    console.log(`[seed-demo-user] FINAL user_id: ${existing.id}`);
    return;
  }

  console.log('[seed-demo-user] user does not exist; creating with custom id');
  const { data, error } = await admin.createUser({
    id,
    email,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { display_name: 'Demo User' },
  });

  if (error) {
    throw new Error(`createUser failed: ${error.message}`);
  }
  if (!data.user) {
    throw new Error('createUser returned no user');
  }

  const createdId = data.user.id;
  if (createdId !== id) {
    console.warn(
      `[seed-demo-user] WARNING: Supabase assigned id (${createdId}) instead of requested ${id}`,
    );
    console.warn(
      '[seed-demo-user] update DEMO_USER_ID in .env.local + Vercel env to the assigned id above.',
    );
  } else {
    console.log(`[seed-demo-user] created user with requested id: ${createdId}`);
  }
  console.log('[seed-demo-user] OK.');
  console.log(`[seed-demo-user] FINAL user_id: ${createdId}`);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('[seed-demo-user] fatal:', msg);
  process.exit(1);
});
