# State of Build — SkoolSkale Community Builder

**Snapshot date:** 2026-05-21 (post `chore/remove-image-generation`)
**Live URL:** https://skoolskale-builder.vercel.app
**Latest production deployment:** _to be updated after this PR merges_

> **Major change in this snapshot:** AI image generation removed entirely.
> The builder is now a pure copy generator. VAs handle community visuals
> (cover, icon, classroom cover, calendar cover) externally in Canva using
> the client's professional photography. See CHANGELOG for the full cut.
>
> **Follow-up:** the five add-on text modules (classroom, calendar,
> leaderboard, categories, discovery_seo) flipped to `includedByDefault:
> true` — every new package now generates 9 modules by default. Step 5
> intake fields remain customizable per package. classroom + calendar
> handle empty intake gracefully (write an empty asset rather than
> failing the module); the other three synthesize from the creator
> profile alone.

---

## What works end-to-end today

A VA can:

1. **Sign in** via the demo-mode auto-session (see Open Items #1).
2. **Create a creator profile** with intake form (`/creators/new`).
3. **Spin up a launch package** (`POST /api/packages` → `POST /api/packages/[id]/generate`).
4. **Watch all 10 text modules generate in parallel** via Inngest + the package detail page polling:
   - `welcome_dm` (Claude Sonnet 4.6)
   - `transformation` (Claude)
   - `about_us` (Claude)
   - `start_here` (Claude)
   - `first_post` — pinned welcome post, title + body (Claude). Reads
     the generated `categories` asset to fill the intro-category name
     — first cross-module dependency in the builder. Polling-with-
     backoff resolver in `src/lib/inngest/resolve-intro-category.ts`
     handles the parallel-dispatch ordering; falls back to "Introduce
     Yourself" if the categories asset is missing, corrupted, or has
     no /intro/i match.
   - `classroom` — title + description per VA-supplied title (Claude)
   - `calendar` — title + description per event (Claude)
   - `leaderboard` — 9 level names (Claude)
   - `categories` — 3 named blocks (Claude)
   - `discovery_seo` — 11 search keywords (Claude)
5. **Edit, regenerate, or approve** each module from the dashboard.
6. **Hit the export page** and copy/paste-ready outputs for Skool deployment.

Package wall-clock is now bounded by the slowest Claude call (typically 5-15s) rather than by Gemini's 30-90s variant generation. Expected total wall-clock: **20-45s** for a 9-module package.

---

## Stack

- **App:** Next.js 15 App Router, TypeScript strict
- **DB:** Supabase Postgres + Drizzle ORM
- **Auth:** Supabase Auth (currently behind demo-mode bypass)
- **AI copy:** Claude Sonnet 4.6 via Vercel AI SDK
- **AI images:** none (removed in chore/remove-image-generation)
- **Background jobs:** Inngest
- **Hosting:** Vercel
- **UI:** shadcn/ui + Tailwind v4

---

## Health checks

| Check | Status |
|---|---|
| `pnpm typecheck` | ✅ clean |
| `pnpm lint` | ✅ clean |
| `pnpm vitest run --no-file-parallelism` | ✅ 402 passed, 3 skipped, 0 failing |
| `pnpm vitest run` (parallel) | ⚠️ flaky — see CLAUDE.md "Mocking conventions" pool-timeout note |
| Anthropic API key | ✅ working |
| Inngest event delivery | ✅ working |
| Supabase RLS on all tables | Workspace-wide model, current per latest review |

---

## Open items / Known issues

### 1. Demo-mode auth bypass is still on (HIGH)
Demo-mode auto-signs anyone hitting the URL as the demo user. Gate by env / flip off before any non-demo audience.

### 2. GOOGLE_AI_API_KEY still in Vercel env vars (LOW — manual cleanup)
The Gemini integration is gone but the sensitive env var lives until Mario removes it via `vercel env rm GOOGLE_AI_API_KEY`. Vercel's UI can't widen or delete sensitive env vars.

### 3. Legacy image storage buckets still provisioned (LOW — ops decision)
`cover-variants` and `image-variants` Supabase buckets remain in place to keep historical cover URLs in deployed Skool communities resolvable. Removal of the buckets (and the orphaned `generated_assets` rows with `module='cover'/'icon'/'classroom_cover'/'calendar_cover'`) is a separate ops decision once the legacy URLs are confirmed retired.

### 4. Test suite is flaky in parallel mode (LOW)
Per CLAUDE.md "Mocking conventions": closure-captured state inside `vi.mock` factories leaks across parallel workers and surfaces as timeouts in unrelated test files. Different test fails each full-suite run, all pass in isolation. CI should run with `--no-file-parallelism` until that's debugged.

### 5. No Canva integration yet
Future sprint.

### 6. No pattern library admin UI yet
Future sprint.

---

## Build scope status

| Scope | Status |
|---|---|
| Foundation + Copy Engine | **✅ Shipped** (9 text modules, dashboard, intake step 5) |
| Canva Integration | **❌ Not started** |
| Pattern Library Intelligence | **❌ Not started** (read-only fetch from DB exists) |

> The "Visual Engine" scope from earlier snapshots is **DEAD** — image generation removed in chore/remove-image-generation. VAs use Canva for all visuals.

---

## Repo paths to know

- `src/lib/modules/registry.ts` — single source of truth for all module-level metadata
- `src/lib/inngest/functions/generate-package.ts` — orchestrator fan-out
- `src/lib/inngest/functions/_factory.ts` + `_shared.ts` — shared Inngest runner (cap-violation retry, edited-prompt path)
- `src/app/api/inngest/route.ts` — Inngest handler
- `src/components/dashboard/module-cards.tsx` — module card components
- `src/components/dashboard/ExportView.tsx` — paste-ready export view
- `src/prompts/<module>.ts` — per-module Claude prompt builders + parsers
- `PRD.md` — full product spec
- `CLAUDE.md` — engineering rules; read before any structural change
