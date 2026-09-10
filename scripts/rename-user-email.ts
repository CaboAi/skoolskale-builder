/**
 * Changes an existing auth user's email address in place.
 *
 * In place matters: `created_by` on every owned row is the user's uuid, and
 * there is no FK to auth.users, so deleting and recreating an account would
 * silently orphan that person's packages against a dead uuid. Editing the
 * email keeps the uuid and therefore the whole history.
 *
 * Goes through the admin API rather than SQL on purpose. Supabase stores the
 * address in both auth.users and the row's auth.identities record; an UPDATE
 * against auth.users alone leaves the identity stale and can break sign-in.
 * admin.updateUserById keeps the two in step.
 *
 * Usage (dry run — prints what it would do, changes nothing):
 *   pnpm user:rename --from old@example.com --to new@skoolskale.com
 *
 * Usage (commits the change):
 *   pnpm user:rename --from old@example.com --to new@skoolskale.com --apply
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Remember: this changes Supabase only. TEAM_EMAIL_ALLOWLIST in Vercel has
 * to name the new address too, or the person is locked out on their next
 * request. See CLAUDE.md and src/lib/auth/allowlist.ts.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

type AdminApi = SupabaseClient['auth']['admin'];

const TAG = '[rename-user-email]';

function readFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

/**
 * Every failure path throws rather than calling process.exit: an abrupt exit
 * while the Supabase client still holds open handles trips a libuv assertion
 * on Windows, which reads like a crash on top of an already-clear message.
 */
function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    console.error(
      `${TAG} usage: pnpm user:rename --from old@x.com --to new@y.com [--apply]`,
    );
    throw new Error(`missing --${name}`);
  }
  return value;
}

async function listAllUsers(admin: AdminApi): Promise<User[]> {
  // Same assumption as seed-demo-user.ts: a single page covers this project.
  const { data, error } = await admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  return data.users;
}

function findByEmail(users: User[], email: string): User | undefined {
  const lower = email.toLowerCase();
  return users.find((u) => u.email?.toLowerCase() === lower);
}

async function main() {
  const url = requireValue(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const key = requireValue(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const from = requireValue('from', readFlag('from')).trim().toLowerCase();
  const to = requireValue('to', readFlag('to')).trim().toLowerCase();
  const apply = process.argv.includes('--apply');

  if (from === to) {
    throw new Error('--from and --to are the same address; nothing to do');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = supabase.auth.admin;

  const users = await listAllUsers(admin);

  const target = findByEmail(users, from);
  if (!target) {
    console.error(`${TAG} known addresses:`);
    for (const u of users) console.error(`${TAG}   ${u.email ?? '(none)'}`);
    throw new Error(`no user with email ${from}`);
  }

  const collision = findByEmail(users, to);
  if (collision) {
    console.error(
      `${TAG} decide which of the two accounts to keep, then delete the other`,
    );
    throw new Error(`${to} already belongs to user ${collision.id} — refusing`);
  }

  console.log(`${TAG} user id:   ${target.id}   (unchanged by this operation)`);
  console.log(`${TAG} from:      ${target.email}`);
  console.log(`${TAG} to:        ${to}`);

  if (!apply) {
    console.log(`${TAG} DRY RUN — nothing written. Re-run with --apply.`);
    return;
  }

  const { data, error } = await admin.updateUserById(target.id, {
    email: to,
    // Skips the confirm-your-new-address round trip. This is an admin acting
    // on a known team member, not a user changing their own address.
    email_confirm: true,
  });
  if (error) throw new Error(`updateUserById failed: ${error.message}`);
  if (!data.user) throw new Error('updateUserById returned no user');

  console.log(`${TAG} updated. email is now ${data.user.email}`);
  console.log(`${TAG} id still ${data.user.id}`);
  console.log(
    `${TAG} NEXT: add ${to} to TEAM_EMAIL_ALLOWLIST in Vercel (and .env.local) and redeploy.`,
  );
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`${TAG} ${msg}`);
  process.exitCode = 1;
});
