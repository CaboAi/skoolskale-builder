/**
 * End-to-end generator pipeline test.
 *
 * Exercises: creator → package → Inngest event → fan-out → Claude → parsers →
 * generated_assets rows. Gated behind two env flags so CI without the required
 * services running stays deterministic:
 *
 *   RUN_DB_TESTS=1       — direct DB access for seeding + polling
 *   RUN_E2E_TESTS=1      — will actually call Claude and spend tokens
 *   INNGEST_DEV_URL=...  — defaults to http://localhost:8288
 *
 * Local run:
 *   1) pnpm dev                              # app (registers /api/inngest)
 *   2) npx inngest-cli@latest dev            # dev server, port 8288
 *   3) RUN_DB_TESTS=1 RUN_E2E_TESTS=1 \
 *      pnpm dlx dotenv-cli -e .env.local -- \
 *      pnpm test tests/integration/e2e/generate-package.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const RUN =
  process.env.RUN_DB_TESTS === '1' && process.env.RUN_E2E_TESTS === '1';
const INNGEST_DEV = process.env.INNGEST_DEV_URL ?? 'http://localhost:8288';
const MAX_WAIT_MS = 180_000;
const POLL_INTERVAL_MS = 3_000;

// Use `test.skipIf` rather than `describe.skip` so vitest reports the test
// as "skipped" (one skipped case) rather than counting it as "0 passed (1)"
// which was confusing when nothing was actually run.
describe('E2E: generate-package pipeline', () => {
  const userId = randomUUID();
  let creatorId: string;
  let packageId: string;
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    if (!RUN) return; // no-op when flags are off — beforeAll still runs, but nothing to set up
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
    sql = postgres(process.env.DATABASE_URL, { max: 2 });

    // Pre-flight: fail fast with a useful message if the dev server isn't up.
    const ping = await fetch(`${INNGEST_DEV}/`).catch(() => null);
    if (!ping || !ping.ok) {
      throw new Error(
        `[e2e] Inngest dev server not reachable at ${INNGEST_DEV}. ` +
          `Start it with: npx inngest-cli@latest dev`,
      );
    }

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
    console.log(`[e2e] seeded creator=${creatorId} package=${packageId}`);
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

  test.skipIf(!RUN)(
    'package.generate.requested → 4 generated_assets rows',
    async () => {
      console.log(`[e2e] firing package.generate.requested for ${packageId}`);
      const res = await fetch(`${INNGEST_DEV}/e/dev`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'package.generate.requested',
          data: { packageId, userId },
        }),
      });
      expect(res.ok, `inngest enqueue ${res.status} ${await res.text()}`).toBe(true);

      const deadline = Date.now() + MAX_WAIT_MS;
      let assets: { module: string; content: unknown }[] = [];
      let lastLog = 0;
      while (Date.now() < deadline) {
        assets = await sql<{ module: string; content: unknown }[]>`
          SELECT module, content FROM generated_assets
          WHERE package_id = ${packageId}
        `;
        if (assets.length >= 4) break;
        if (Date.now() - lastLog > 15_000) {
          console.log(
            `[e2e] ${assets.length}/4 modules done — still waiting…`,
          );
          lastLog = Date.now();
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      const modules = new Set(assets.map((a) => a.module));
      expect(modules).toEqual(
        new Set(['welcome_dm', 'transformation', 'about_us', 'start_here']),
      );
      for (const a of assets) expect(a.content).toBeTruthy();

      const [pkg] = await sql<{ status: string }[]>`
        SELECT status FROM launch_packages WHERE id = ${packageId}
      `;
      expect(pkg.status).toBe('review');

      const jobs = await sql<
        { status: string; claude_usage: unknown }[]
      >`SELECT status, claude_usage FROM generation_jobs WHERE package_id = ${packageId}`;
      expect(jobs.length).toBe(4);
      for (const j of jobs) {
        expect(j.status).toBe('done');
        expect(j.claude_usage).toBeTruthy();
      }
    },
    MAX_WAIT_MS + 10_000,
  );
});
