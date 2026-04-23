# SPRINT_1_TICKETS.md — Exact prompts for Claude Code

Once Sprint 0 is done, work these tickets in order. Each ticket tells you which agent to invoke and exactly what to paste into Claude Code.

After each ticket completes, commit with the suggested message and move on. `qa-reviewer` runs at the end of the sprint.

---

## Ticket 1.1 — Drizzle Schema (database-architect)

**Agent:** `database-architect`
**Depends on:** Sprint 0 complete
**Deliverable:** All Phase 1 tables defined in Drizzle, migration generated and applied

**Paste this prompt into Claude Code:**

> Use the `database-architect` subagent. Read `PRD.md` section 6.3 and implement the Drizzle schema at `/src/lib/db/schema.ts` for Phase 1 tables only. The Phase 1 tables are:
>
> - `creators`
> - `launch_packages`
> - `generated_assets`
> - `generation_jobs`
> - `pattern_library`
> - `audit_log`
>
> Skip Phase 3/4 tables (`canva_template_registry`, `canva_generations`, `feedback_events`) — they'll come later.
>
> Use proper Drizzle types: `uuid()` for primary keys (with `defaultRandom()`), `timestamp()` for dates, `pgEnum()` for status/tone/niche/module, and `jsonb()` for structured fields.
>
> Set up the Drizzle client at `/src/lib/db/index.ts` using `postgres-js` against `env.DATABASE_URL`.
>
> Generate the migration with `pnpm drizzle-kit generate`. Do not apply yet — ticket 1.2 handles RLS and we'll run both migrations together.

**Commit:** `feat(db): phase 1 drizzle schema`

---

## Ticket 1.2 — RLS Policies (database-architect)

**Agent:** `database-architect`
**Depends on:** 1.1
**Deliverable:** Row Level Security policies on every table, applied via a second migration

**Paste into Claude Code:**

> Use the `database-architect` subagent. Add RLS policies for all Phase 1 tables as a new migration file under `/drizzle/migrations/`. Write raw SQL for the RLS portion since Drizzle-Kit doesn't manage policies natively.
>
> Policy rules:
>
> - `creators`, `launch_packages`, `generated_assets`, `generation_jobs`, `audit_log`: authed user can SELECT/INSERT/UPDATE/DELETE rows where `created_by = auth.uid()`. Admins (JWT claim `role = 'admin'`) see all.
> - `pattern_library`: SELECT open to all authed users. INSERT/UPDATE/DELETE admin-only.
>
> Enable RLS on every table with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
>
> After writing the migration, run `pnpm drizzle-kit push` to apply both migrations (1.1 and 1.2) to the Supabase DB. Verify in the Supabase dashboard that tables exist with RLS enabled (shield icon).

**Commit:** `feat(db): row-level security policies`

---

## Ticket 1.3 — Pattern Library Seed (database-architect)

**Agent:** `database-architect`
**Depends on:** 1.2
**Deliverable:** Seed script populates `pattern_library` from `/seeds/patterns.json`

**Paste into Claude Code:**

> Use the `database-architect` subagent. Create a seed script at `/drizzle/seed.ts` that:
>
> 1. Reads `/seeds/patterns.json`
> 2. Uses the service-role Supabase client (`createServiceClient` from `/src/lib/supabase/server.ts`) to bypass RLS
> 3. Inserts each entry into `pattern_library` with appropriate `module`, `niche`, `tone`, `example_content`, and `source_creator` values
> 4. Is idempotent — running twice should not duplicate rows (use `ON CONFLICT DO NOTHING` on a unique combo of module+source_creator, or clear the table first if `--reset` flag is passed)
>
> Add a `pnpm db:seed` script to `package.json` that runs `tsx drizzle/seed.ts`.
>
> Run it. Verify rows in Supabase dashboard.

**Commit:** `feat(db): seed pattern library`

---

## Ticket 1.4 — Supabase Auth + Email Allowlist (backend-engineer)

**Agent:** `backend-engineer`
**Depends on:** 1.2
**Deliverable:** Magic-link login flow with email allowlist gating

**Paste into Claude Code:**

> Use the `backend-engineer` subagent. Build the authentication layer:
>
> 1. Create `/src/lib/auth/allowlist.ts` — a helper that checks if an email is in `env.TEAM_EMAIL_ALLOWLIST` (case-insensitive).
> 2. Create a middleware at `/src/middleware.ts` (Next.js root middleware) that:
>    - Refreshes the Supabase session
>    - Redirects unauthenticated users to `/auth/login`
>    - On `/auth/callback`, checks the allowlist; if email not allowed, signs them out and redirects to `/auth/not-allowed`
> 3. Create pages:
>    - `/auth/login` — email input + "Send magic link" button (use `supabase.auth.signInWithOtp()`)
>    - `/auth/callback` — Supabase OAuth callback handler
>    - `/auth/not-allowed` — simple "your email isn't authorized, contact admin" page
> 4. Create `/src/lib/auth/require.ts` with two helpers:
>    - `requireUser()` — server-side, returns the authed user or redirects to login
>    - `requireAdmin()` — returns authed user if admin role, else 403
>
> Use shadcn `<Button>`, `<Input>`, `<Label>`, `<Card>` for the login page. Don't overdesign — functional, clean.

**Commit:** `feat(auth): magic-link login with email allowlist`

---

## Ticket 1.5 — /api/creators CRUD (backend-engineer)

**Agent:** `backend-engineer`
**Depends on:** 1.2, 1.4
**Deliverable:** Route handlers for creator CRUD

**Paste into Claude Code:**

> Use the `backend-engineer` subagent. Build CRUD routes for creators:
>
> - `POST /api/creators` — create
> - `GET /api/creators` — list current user's creators
> - `GET /api/creators/:id` — fetch one
> - `PATCH /api/creators/:id` — update (for draft autosave)
>
> Define the Zod schema at `/src/types/schemas.ts`:
>
> ```ts
> export const CreatorIntakeSchema = z.object({
>   name: z.string().min(1).max(200),
>   community_name: z.string().min(1).max(200),
>   niche: z.enum(['spiritual', 'business', 'fitness', 'relationships', 'money', 'yoga', 'other']),
>   audience: z.string().min(1),
>   transformation: z.string().min(1),
>   tone: z.enum(['loving', 'direct', 'playful']),
>   offer_breakdown: z.object({
>     courses: z.array(z.object({ name: z.string(), description: z.string().optional() })).default([]),
>     live_calls: z.string().optional(),
>     perks: z.array(z.string()).default([]),
>     events: z.array(z.string()).default([]),
>     guest_sessions: z.boolean().default(false),
>   }),
>   pricing: z.object({
>     monthly: z.number().optional(),
>     annual: z.number().optional(),
>     tiers: z.array(z.object({ name: z.string(), price: z.string() })).default([]),
>   }),
>   trial_terms: z.object({ has_trial: z.boolean(), duration_days: z.number().optional() }),
>   refund_policy: z.string(),
>   support_contact: z.string().min(1),
>   brand_prefs: z.string(),
>   creator_photo_url: z.string().url().optional(),
> });
> ```
>
> Every route:
> - Calls `requireUser()` first
> - Validates input with Zod
> - Uses Drizzle queries (no raw SQL)
> - Writes to `audit_log` on mutations
> - Returns typed JSON responses
>
> Add integration tests at `/tests/integration/api/creators.test.ts`.

**Commit:** `feat(api): creator CRUD routes`

---

## Ticket 1.6 — QA Review (qa-reviewer)

**Agent:** `qa-reviewer`
**Depends on:** 1.1, 1.2, 1.3, 1.4, 1.5

**Paste into Claude Code:**

> Use the `qa-reviewer` subagent. Review all of Sprint 1:
>
> 1. Run full test suite: `pnpm typecheck`, `pnpm lint`, `pnpm test`
> 2. Verify RLS is enforced by writing an integration test that:
>    - Creates two users via service-role client
>    - Each user inserts a creator
>    - User A logs in via authed client and selects creators — must only see their own
>    - User B same check
> 3. Verify the seed ran: query `pattern_library` count > 0
> 4. Walk through login flow manually: enter allowlisted email → get magic link → land on dashboard. Then try non-allowlisted email → hit not-allowed page.
> 5. Produce the QA Review checklist per your agent spec.
>
> Report findings. If blockers exist, describe what's needed. If clean, approve Sprint 1.

**Commit (if clean):** `chore(sprint-1): qa passed`

---

## 🎉 Sprint 1 Done

At this point you have:
- ✅ Full Phase 1 schema in Supabase with RLS
- ✅ Pattern library seeded with Ramsha's examples
- ✅ Magic-link auth with email allowlist
- ✅ Creator CRUD API
- ✅ Test coverage on business logic and RLS

**Next:** Sprint 2 (intake form UI) — starts with `frontend-engineer`. I'll draft Sprint 2 tickets when you're ready.

---

## Working Pattern

For each ticket:
1. Paste the prompt into Claude Code
2. Let the agent work through it (Claude Code handles the subagent invocation)
3. Review the diff — use your judgment, even though we have `qa-reviewer` at the end
4. Commit with the suggested message
5. Move to the next ticket

If an agent produces something off-spec, push back in Claude Code. The agents respect `CLAUDE.md` and their own agent files — reference those rules when correcting.

If you hit a blocker not covered in the PRD, stop and we'll talk it through.
