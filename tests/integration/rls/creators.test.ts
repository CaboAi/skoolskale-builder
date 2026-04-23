/**
 * RLS integration test for the `creators` table.
 *
 * Why this test can't use the Drizzle client from @/lib/db:
 *   The app's Drizzle client connects with the `postgres` superuser
 *   (Supabase's DATABASE_URL direct connection). Postgres superusers have
 *   BYPASSRLS, so policies never fire — every row is visible regardless of
 *   auth.uid(). That's intentional for server-side app queries (we enforce
 *   owner-scoping in the handler via `WHERE created_by = user.id`).
 *
 *   To actually exercise the RLS policies, we have to connect as the
 *   `authenticated` role and set the JWT claims Postgres's policies look at.
 *   That's what this test does, via SET LOCAL.
 *
 * How to run:
 *   RUN_DB_TESTS=1 pnpm test
 *   (requires DATABASE_URL in .env.local; skipped by default so CI without
 *   DB access doesn't fail.)
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const RUN = process.env.RUN_DB_TESTS === '1';
const describeOrSkip = RUN ? describe : describe.skip;

const VALID_CREATOR_VALUES = (ownerUuid: string) => ({
  name: 'RLS Test Jane',
  community_name: 'RLS Test Community',
  niche: 'spiritual' as const,
  audience: 'Testers',
  transformation: 'Write tests',
  tone: 'direct' as const,
  offer_breakdown: { courses: [], live_calls: null, perks: [], events: [], guest_sessions: false },
  pricing: { tiers: [] },
  trial_terms: { has_trial: false },
  refund_policy: 'none',
  support_contact: 'rls@test.example',
  brand_prefs: '',
  creator_photo_url: null,
  created_by: ownerUuid,
});

describeOrSkip('RLS: creators table — owner-scoped visibility', () => {
  const userA = randomUUID();
  const userB = randomUUID();
  const insertedIds: string[] = [];

  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
    sql = postgres(process.env.DATABASE_URL, { max: 2 });
  });

  afterAll(async () => {
    // Clean up as the owning user (policies allow their own delete)
    // We use the superuser connection for cleanup to not depend on policy
    // correctness to delete our test rows.
    if (insertedIds.length > 0) {
      await sql`DELETE FROM creators WHERE id = ANY(${insertedIds})`;
    }
    await sql.end({ timeout: 2 });
  });

  test('user A inserts a row; user A sees it; user B does not', async () => {
    const row = VALID_CREATOR_VALUES(userA);

    // --- Insert as user A (via superuser connection; RLS bypassed).
    //     This isolates the test from INSERT-policy correctness; we only
    //     want to prove SELECT policies scope correctly.
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO creators (
        name, community_name, niche, audience, transformation, tone,
        offer_breakdown, pricing, trial_terms, refund_policy,
        support_contact, brand_prefs, creator_photo_url, created_by
      ) VALUES (
        ${row.name}, ${row.community_name}, ${row.niche}, ${row.audience},
        ${row.transformation}, ${row.tone},
        ${sql.json(row.offer_breakdown)}, ${sql.json(row.pricing)},
        ${sql.json(row.trial_terms)}, ${row.refund_policy},
        ${row.support_contact}, ${row.brand_prefs}, ${row.creator_photo_url},
        ${row.created_by}
      )
      RETURNING id
    `;
    insertedIds.push(inserted[0].id);

    // --- Query as user A in a transaction with RLS enforced.
    //     SET LOCAL ROLE drops us to 'authenticated'; SET LOCAL "request.jwt.claims"
    //     is what Postgres's auth.uid() and auth.jwt() read.
    const asUserA = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE authenticated`);
      await tx.unsafe(
        `SET LOCAL "request.jwt.claims" = '${JSON.stringify({
          sub: userA,
          role: 'authenticated',
        })}'`,
      );
      return tx<{ id: string }[]>`SELECT id FROM creators WHERE id = ${inserted[0].id}`;
    });

    expect(asUserA.map((r) => r.id)).toEqual([inserted[0].id]);

    // --- Query as user B. Expect empty — policy filters user A's row out.
    const asUserB = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE authenticated`);
      await tx.unsafe(
        `SET LOCAL "request.jwt.claims" = '${JSON.stringify({
          sub: userB,
          role: 'authenticated',
        })}'`,
      );
      return tx<{ id: string }[]>`SELECT id FROM creators WHERE id = ${inserted[0].id}`;
    });

    expect(asUserB).toEqual([]);
  });

  test('admin role sees all rows regardless of created_by', async () => {
    // Seed row owned by userA (if first test didn't run in isolation mode).
    const row = VALID_CREATOR_VALUES(userA);
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO creators (
        name, community_name, niche, audience, transformation, tone,
        offer_breakdown, pricing, trial_terms, refund_policy,
        support_contact, brand_prefs, creator_photo_url, created_by
      ) VALUES (
        ${row.name}, ${row.community_name}, ${row.niche}, ${row.audience},
        ${row.transformation}, ${row.tone},
        ${sql.json(row.offer_breakdown)}, ${sql.json(row.pricing)},
        ${sql.json(row.trial_terms)}, ${row.refund_policy},
        ${row.support_contact}, ${row.brand_prefs}, ${row.creator_photo_url},
        ${row.created_by}
      )
      RETURNING id
    `;
    insertedIds.push(inserted[0].id);

    // Admin = userB with role=admin claim.
    const asAdmin = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE authenticated`);
      await tx.unsafe(
        `SET LOCAL "request.jwt.claims" = '${JSON.stringify({
          sub: userB,
          role: 'admin',
        })}'`,
      );
      return tx<{ id: string }[]>`SELECT id FROM creators WHERE id = ${inserted[0].id}`;
    });

    expect(asAdmin.map((r) => r.id)).toEqual([inserted[0].id]);
  });
});
