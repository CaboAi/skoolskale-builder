# SkoolSkale Community Builder — Architecture Brief for External Review

**Prepared for:** external developer review / scaling audit
**Repo:** `CaboAi/skoolskale-builder`
**Live:** https://skoolskale-builder.vercel.app
**Date:** 2026-09-04

---

## 1. What this thing is

Internal tool for the Skool Skale agency. A VA fills out a creator intake form once,
and the app generates the entire launch package for that creator's Skool community:
all the copy (welcome DM, About Us, Start Here, first post, classroom/calendar
descriptions, leaderboard level names, categories, SEO keywords), a set of branded
images, and a 6-document pre-launch client handover package rendered to PDF.

Output is copy/paste-ready. The VA reviews and approves each module in a dashboard,
then deploys it into Skool by hand. Nobody outside the agency touches this app.

Today: 1-2 people using it. Target: 5+ VAs running full buildouts concurrently,
which is where I want your read.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Hosting | Vercel (currently **Hobby plan** — this matters, see §7) |
| Database | Supabase Postgres, Drizzle ORM, `postgres-js` driver |
| Auth | Supabase Auth (magic link) + server-side email allowlist |
| Storage | Supabase Storage, private buckets, signed URLs only |
| Background jobs | **Inngest** — all long-running work, no exceptions |
| Copy generation | Claude Sonnet 4.6 via Vercel AI SDK (`generateText`) |
| Handover docs | Claude Opus 4.8 via raw `@anthropic-ai/sdk` + prompt caching |
| Images | OpenAI `gpt-image-1` (quality `high`) via raw `fetch` |
| Image post-processing | `sharp` (centre-crop + resize to exact Skool pixel specs) |
| PDF rendering | `puppeteer-core` + `@sparticuz/chromium` inside the Inngest function |
| UI | shadcn/ui + Tailwind v4, React Hook Form + Zod, TanStack Query + Zustand |

---

## 3. The core architectural rule

**No external AI call ever happens inside an API route.** API routes validate,
authorize, write a job row, fire an Inngest event, and return immediately.
All the slow work runs in Inngest functions with durable step execution and retries.

This is enforced by convention (documented in `CLAUDE.md`) rather than by tooling,
which is one of the things worth auditing.

Request shape looks like:

```
Browser → POST /api/packages/[id]/generate
            ├─ auth check (Supabase session + allowlist)
            ├─ Zod validate
            ├─ INSERT generation_jobs (status: queued)
            ├─ inngest.send({ name: "package.generate.requested" })
            └─ 202 back to the browser

Inngest → generate-package (orchestrator)
            └─ step.invoke × 10 modules, in parallel
                 each: create job row → load creator + pattern library
                       → call Claude → parse + validate output
                       → write generated_assets → close job row

Browser  → polls GET /api/packages/[id] every 3-5s via TanStack Query
            until status flips to 'review'
```

There is no websocket/SSE layer. Progress is DB polling. Deliberate for now,
but it's a load multiplier as user count grows.

---

## 4. Three separate Inngest apps (this surprises people)

The app registers **three** distinct Inngest apps on three Vercel routes:

| App | Route | Why it's split out |
|---|---|---|
| `skoolskale-builder` | `/api/inngest` | The 10 copy modules |
| `skoolskale-builder-handover` | `/api/inngest-handover` | Carries the ~70MB Chromium payload for PDF rendering |
| `skoolskale-builder-images` | `/api/inngest-images` | Carries `sharp`'s native libvips binaries |

The split is a blast-radius decision, not an aesthetic one. Both `sharp` and
`@sparticuz/chromium` ship native binaries that Vercel's file tracer does not copy
into the function bundle by default. When `sharp` failed to load, every route that
transitively imported it 500'd **at import time** — including the copy pipeline that
has nothing to do with images. Splitting the serve endpoints means a native-binary
problem can only take down the pipeline that actually needs the binary.

The fixes for those (`serverExternalPackages`, `outputFileTracingIncludes` globs,
`sharp`'s platform packages pinned as direct `optionalDependencies`) are documented
inline in `next.config.ts` and `package.json`. Those comments are the record of about
four failed deploys — worth reading before you touch either file.

---

## 5. The three pipelines, with real numbers

**A. Copy modules** — `src/lib/inngest/functions/`
10 modules fan out in parallel via `step.invoke`. Each is Claude Sonnet 4.6, one call,
5-15s. Whole package lands in **20-45s**. Each module has 3 Inngest retries plus one
special-cased "rewrite tighter" retry when output blows Skool's character caps
(300 chars on welcome DM, 1050 on About Us). Prompts live in `src/prompts/<module>.ts`,
in Git, never in the DB. Every module has a hand-written output parser; those parsers
are the only thing standing between a model hallucination and the VA's clipboard.

**B. Handover package** — `src/lib/inngest/functions/generate-handover.ts`
Six client-facing documents (VSL script, pre/post-launch email sequences, docuseries
script, DM sequences) on Claude Opus 4.8 with Anthropic prompt caching. The five
generation calls share a byte-identical system prefix (~framework docs + gold examples
+ the full package DNA). Deliverable 01 fires alone to **write** the cache; the other
four then fire concurrently as cache **reads** at ~10% input price. Measured at
**~$1/package**. Longest single doc is ~56s. Each doc then renders to a styled PDF
via headless Chromium inside the same run and uploads to a private bucket.

**C. Images** — `src/lib/inngest/functions/generate-images.ts`
Up to 12 slots per run (icon, classroom cover, calendar cover, About Us panels,
Start Here thumbs, join-now banner). `gpt-image-1` at `quality: high` runs
**60-90s per image**, and they run **strictly one at a time** — deliberately, no
`Promise.all` anywhere in that file. So a full image run is **12-18 minutes** of
wall clock. The serialism isn't only politeness to the API: `gpt-image-1` has no
seed parameter, so the first generated banner is fed back as a reference image to
every subsequent one. That's the only lever we have on visual drift within a package.
That anchor is carried in the step return value, not a closure variable, because
Inngest replays runs from memoized step results.

---

## 6. Data, auth, and access model

**12 tables:** `creators`, `launch_packages`, `generated_assets`, `generation_jobs`,
`handover_runs`, `handover_documents`, `image_style_specs`, `image_references`,
`image_runs`, `image_assets`, `pattern_library`, `audit_log`. Schema source of truth
is `src/lib/db/schema.ts`; migrations in `drizzle/`.

**Auth:** Supabase magic link. An email allowlist (`TEAM_EMAIL_ALLOWLIST`) is checked
server-side at `/auth/callback` when the session is established, not on every request.
There's a `DEMO_MODE` that auto-mints a session for a demo user; the env validator
hard-fails the build if it's ever truthy with `VERCEL_ENV=production`.

**RLS:** every table has policies, but the model is deliberately **workspace-wide** —
any authenticated user can SELECT/UPDATE/DELETE any row. INSERT is the only
ownership-checked operation (`created_by = auth.uid()`). Rationale: VAs need to pick
up each other's packages. This is a conscious call, not an oversight, but it means
**RLS is not currently a real isolation boundary** — the allowlist is. If we ever put
a client in front of this, the whole policy set gets rewritten.

**Storage:** all buckets private, all reads go through 1-hour signed URLs regenerated
on every page render. Dashboard/export pages are `force-dynamic` so cached RSC payloads
can't ship stale tokens.

**Audit:** every state-changing action writes to `audit_log`. Enforced by convention.

---

## 7. Ops reality — the honest part

These are the things I already know are wrong. I'd rather you spend your time on what
I *haven't* spotted.

1. **One Supabase project. No dev/staging DB.** `.env.local` points at the same
   Postgres that production uses. Local development writes to prod.
2. **Migrations don't auto-apply on deploy.** Every PR touching `drizzle/` or the
   storage-bucket script needs a manual `drizzle-kit migrate` / `pnpm storage:setup`
   run against prod, before or after merge. We've already shipped a PR where the code
   went green and the migration never ran — the app 500'd on enum casts in production.
   There's a PR-template checklist forcing a pause on this now. It's a checklist, not
   a mechanism.
3. **Vercel Hobby plan.** Hard 300s function ceiling. Comments in the code note that
   Pro/Fluid would allow 800s. Every `maxDuration` in the app is pinned at 300 because
   the build literally fails above it.
4. **No CI.** `.github/` contains a PR template and nothing else. Tests, typecheck,
   and lint run on my machine or not at all. ~400 tests across 78 files; the suite is
   flaky under Vitest's parallel workers (mock state leaking across workers) and has to
   be run with `--no-file-parallelism`.
5. **No error monitoring.** `CLAUDE.md` claims Sentry + PostHog. Neither is actually
   installed. `SENTRY_DSN` is an optional env var wired to nothing. Production failures
   surface as a `failed` job row in the dashboard or not at all.
6. **`postgres-js` pool is `max: 10` per serverless instance.** Fine at 1 user, and I
   suspect it's the first thing to break at 5.
7. **No global concurrency limit on the copy pipeline.** Inngest concurrency is keyed
   `per packageId` on handover (5) and images (1), but the 10 copy modules have no cap
   at all. Five VAs generating simultaneously = 50 concurrent Anthropic calls. There is
   no 429-specific backoff on that path — only Inngest's generic 3 retries. The image
   pipeline is the only place that classifies transient errors (408/429/5xx) explicitly.
8. **No rate limiting or abuse protection on any API route.** Internal tool, allowlisted
   users, so low priority — but stating it so it's not a discovery.

---

## 8. Where we're trying to take it

**Target state:** 5+ VAs each running a full buildout (copy → images → handover)
concurrently, without any one of them slowing the others down, and without me
manually applying migrations to a production database.

**Specific things I'd like your read on:**

1. **Concurrency and rate limits.** At 5 concurrent buildouts that's ~50 parallel
   Claude Sonnet calls, ~5 parallel `gpt-image-1` calls, and up to 25 Opus calls if
   handovers overlap. Where does that hit provider limits first, and is the fix
   Inngest global concurrency keys, a token-bucket in front of the providers, or
   provider-tier upgrades? What's the right ordering?

2. **DB connections.** Serverless + `postgres-js` at `max: 10` per instance,
   multiplied by however many Vercel instances Inngest spins up. Should we be on
   Supabase's transaction pooler / PgBouncer, and does that break anything Drizzle
   or the migration tooling relies on?

3. **The polling model.** 5 users × 3-5s polls, each hitting a query that batch-signs
   storage URLs. Does this need to become SSE/websockets/Supabase Realtime before
   5 users, or is it fine and I'm inventing a problem?

4. **Environment separation.** What's the minimum-effort path to a real staging DB
   and auto-applied migrations without turning this into a two-week platform project?
   Supabase branching, a second project, something else?

5. **The 12-18 minute serial image run.** It's serial for a real reason (style
   consistency via reference-image anchoring). Is there a way to parallelize without
   losing the visual anchor, or is the right answer to accept it and just make the
   queueing and progress reporting better?

6. **Anything in §7 you'd reorder.** I've listed what I know. I'm more interested in
   what I've missed, and in which of these actually bites at 5 users versus which is
   theoretical until 50.

---

## 9. Where to look in the repo

| Path | What's there |
|---|---|
| `CLAUDE.md` | Engineering rules, architectural constraints, anti-patterns. Read first. |
| `PRD.md` | Full product spec |
| `state_of_build.md` | Build status snapshot (partially stale — predates the images and handover work) |
| `CHANGELOG.md` | Detailed decision history, including why things were removed |
| `src/lib/inngest/client.ts` | The three-app split, with rationale |
| `src/lib/inngest/functions/` | Every background job |
| `src/lib/db/schema.ts` | Schema source of truth |
| `drizzle/0006_workspace_wide_rls.sql` | The current RLS model |
| `next.config.ts` | Native-binary deploy fixes, heavily commented |
| `src/lib/env.ts` | Every env var the app expects |

Happy to walk through any of it live. The inline comments are unusually dense on
purpose — most of them are post-mortems of something that broke in production.
