/**
 * End-to-end generator pipeline test.
 *
 * Exercises the full chain: creator → package → generate endpoint → Inngest
 * fan-out → Claude → parsers → generated_assets rows. Because the pipeline
 * depends on live Claude + a running Inngest dev server (`npx inngest-cli dev`),
 * this test is gated behind env flags:
 *
 *   RUN_DB_TESTS=1       (direct DB access for seeding + polling)
 *   RUN_E2E_TESTS=1      (will actually call Claude and spend tokens)
 *   INNGEST_DEV_URL=...  (defaults to http://localhost:8288 if omitted)
 *
 * Without these, the test file is a no-op. This keeps CI deterministic and
 * the local run opt-in.
 *
 * To run locally:
 *   1) pnpm dev                         # app
 *   2) npx inngest-cli@latest dev       # inngest dev server (port 8288)
 *   3) RUN_DB_TESTS=1 RUN_E2E_TESTS=1 pnpm dlx dotenv-cli -e .env.local -- \
 *        pnpm test tests/integration/e2e/generate-package.test.ts
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const RUN =
  process.env.RUN_DB_TESTS === '1' && process.env.RUN_E2E_TESTS === '1';
const describeOrSkip = RUN ? describe : describe.skip;

const INNGEST_DEV = process.env.INNGEST_DEV_URL ?? 'http://localhost:8288';
const MAX_WAIT_MS = 180_000; // 3 min cap for all 4 modules
const POLL_INTERVAL_MS = 3_000;

describeOrSkip('E2E: generate-package pipeline', () => {
  const userId = randomUUID();
  let creatorId: string;
  let packageId: string;
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
    sql = postgres(process.env.DATABASE_URL, { max: 2 });

    // Seed the creator + package directly; the HTTP endpoints require an
    // authed session which we can't easily fake here. The pipeline under
    // test is the Inngest fan-out, not the auth layer.
    const [creator] = await sql<{ id: string }[]>`
      INSERT INTO creators (
        name, community_name, niche, audience, transformation, tone,
        offer_breakdown, pricing, trial_terms, refund_policy,
        support_contact, brand_prefs, created_by
      ) VALUES (
        'E2E Creator', 'E2E Community', 'spiritual',
        'Soul-led women 30-55',
        'Reclaim your power and step into your truth.',
        'loving',
        ${sql.json({ courses: [{ name: 'Foundations' }], perks: [], events: [], guest_sessions: false })},
        ${sql.json({ monthly: 47, annual: 470, tiers: [] })},
        ${sql.json({ has_trial: true, duration_days: 7 })},
        '14-day refund, no questions asked.',
        'support@e2e.test', 'soft gold + deep teal',
        ${userId}
      )
      RETURNING id
    `;
    creatorId = creator.id;

    const [pkg] = await sql<{ id: string }[]>`
      INSERT INTO launch_packages (creator_id, status, created_by)
      VALUES (${creatorId}, 'generating', ${userId})
      RETURNING id
    `;
    packageId = pkg.id;
  });

  afterAll(async () => {
    if (!sql) return;
    if (packageId) {
      await sql`DELETE FROM generation_jobs WHERE package_id = ${packageId}`;
      await sql`DELETE FROM generated_assets WHERE package_id = ${packageId}`;
      await sql`DELETE FROM launch_packages WHERE id = ${packageId}`;
    }
    if (creatorId) {
      await sql`DELETE FROM creators WHERE id = ${creatorId}`;
    }
    await sql.end({ timeout: 2 });
  });

  test(
    'package.generate.requested → 4 generated_assets rows',
    async () => {
      // Fire the event directly through the Inngest dev server. Bypasses the
      // Next.js auth layer; the functions read from DB anyway.
      const res = await fetch(`${INNGEST_DEV}/e/dev`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'package.generate.requested',
          data: { packageId, userId },
        }),
      });
      expect(res.ok, `inngest enqueue ${res.status}`).toBe(true);

      // Poll for 4 assets with content.
      const deadline = Date.now() + MAX_WAIT_MS;
      let assets: { module: string; content: unknown }[] = [];
      while (Date.now() < deadline) {
        assets = await sql<{ module: string; content: unknown }[]>`
          SELECT module, content FROM generated_assets
          WHERE package_id = ${packageId}
        `;
        if (assets.length >= 4) break;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      const modules = new Set(assets.map((a) => a.module));
      expect(modules).toEqual(
        new Set(['welcome_dm', 'transformation', 'about_us', 'start_here']),
      );

      // Every asset should have parsed content (non-empty jsonb).
      for (const a of assets) {
        expect(a.content).toBeTruthy();
      }

      // Launch package should be in 'review' state post-generation.
      const [pkg] = await sql<{ status: string }[]>`
        SELECT status FROM launch_packages WHERE id = ${packageId}
      `;
      expect(pkg.status).toBe('review');

      // generation_jobs should all be 'done' with claude_usage logged.
      const jobs = await sql<
        { status: string; claude_usage: unknown }[]
      >`
        SELECT status, claude_usage FROM generation_jobs
        WHERE package_id = ${packageId}
      `;
      expect(jobs.length).toBe(4);
      for (const j of jobs) {
        expect(j.status).toBe('done');
        expect(j.claude_usage).toBeTruthy();
      }
    },
    MAX_WAIT_MS + 10_000,
  );
});
