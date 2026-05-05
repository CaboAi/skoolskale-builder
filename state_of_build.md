# State of Build — SkoolSkale Community Builder

**Snapshot date:** 2026-05-03
**Demo to client:** 2026-05-04 (tomorrow)
**Live URL:** https://skoolskale-builder.vercel.app
**Latest production deployment:** `dpl_5Rg5PuEptePSVXaMyW5cQWH7DdCf` (commit `b29e3ef`, plus a newer build pending for `b29e3ef` follow-ups — see Open Items)

---

## What works end-to-end today

A VA can:

1. **Sign in** via the demo-mode auto-session (skips magic link for the demo window — see Open Items #1).
2. **Create a creator profile** with intake form (`/creators/new`).
3. **Spin up a launch package** (`POST /api/packages` → `POST /api/packages/[id]/generate`).
4. **Watch all 5 modules generate in parallel** via Inngest + the package detail page polling:
   - `welcome_dm` (Claude Sonnet 4.6)
   - `transformation` (Claude)
   - `about_us` (Claude)
   - `start_here` (Claude)
   - `cover` (Gemini 3.1 Flash Image — 3 variants in parallel)
5. **Edit, regenerate, or approve** each module from the dashboard.
6. **Select one of three cover variants** and approve.
7. **Hit the export page** and copy/paste-ready outputs for Skool deployment.

Confirmed by Mario in production at 21:21:43 today: package `0ba5c6de-...` generated all 5 modules including 3 cover variants in **~4:18 wall-clock** (one Gemini hang triggered a retry). After the perf patch in `b29e3ef`, expected wall-clock is **30s best case, ~90s worst case**.

---

## What was fixed today (2026-05-03)

In demo-prep order, all on `master`:

| Commit | Why |
|---|---|
| `4364928` `fix(cover): durable per-variant steps to survive Vercel timeouts` | Old code ran 3 Gemini calls + uploads in one `step.run`. A single 504 retried everything from zero. Split into `prepare` + `variant-1/2/3` (parallel) + `finalize`. Each variant's URL persists across retries. Bumped `/api/inngest` `maxDuration` to 300s. |
| `d43dff9` `fix(cover): hard timeout on Gemini calls so stuck images retry fast` | Gemini SDK occasionally hangs indefinitely. Added 60s `Promise.race` timeout per call and 10s `AbortSignal.timeout` on reference-image fetch so we fail fast instead of waiting for Vercel to 504. |
| `b29e3ef` `perf(cover): inline retries and tighter timeout` | Inngest's exponential retry backoff was adding 1–2 min between attempts. Replaced with an inline 2-attempt retry loop inside each variant `step.run`. Tightened Gemini timeout 90s → 60s. |
| (uncommitted) `tests/unit/gemini-image/generate.test.ts` updated to assert the new `AbortSignal` arg on the reference fetch. Test now green. |

Also during the session: discovered `GOOGLE_AI_API_KEY` in Vercel env vars was either missing or invalid. Re-pasted the Skool Skale project key, redeployed. Cover gen works.

---

## Stack (unchanged)

- **App:** Next.js 15 App Router, TypeScript strict
- **DB:** Supabase Postgres + Drizzle ORM
- **Auth:** Supabase Auth (currently behind demo-mode bypass)
- **Storage:** Supabase Storage (`cover-variants` bucket, public URLs — see Tech Debt)
- **AI copy:** Claude Sonnet 4.6 via Vercel AI SDK
- **AI images:** Gemini 3.1 Flash Image Preview (`gemini-3.1-flash-image-preview`) via `@google/genai`
- **Background jobs:** Inngest
- **Hosting:** Vercel (Hobby plan — confirm if `maxDuration: 300` is honored in prod)
- **UI:** shadcn/ui + Tailwind v4

---

## Health checks

| Check | Status |
|---|---|
| `pnpm typecheck` | ✅ clean |
| `pnpm vitest run` | ✅ **70 passed, 3 skipped, 0 failing** |
| Production deploy (latest) | ✅ live |
| Cover gen end-to-end | ✅ verified (package `0ba5c6de-...`, 21:21:43 UTC) |
| All 4 copy modules end-to-end | ✅ verified same run |
| Gemini API key + project quota | ✅ Skool Skale key, paid tier, $0.55 balance |
| Anthropic API key | ✅ working (Claude calls succeed) |
| Inngest event delivery | ✅ working |
| Supabase RLS on all tables | Assumed pass — no new tables since last review |

---

## Open items / Known issues

### 1. Demo-mode auth bypass is still on (HIGH)
Three commits (`eed3533`, `fc0a033`, `199a170`) bypass `requireUser` for the Monday demo. **Roll back or gate by env var before any non-demo deployment.** Currently anyone hitting the URL is auto-signed in as the demo user.

### 2. Cover image-gen provider will swap to Ideogram at handover (MEDIUM)
Client wants Ideogram, not Gemini. Agency's `GOOGLE_AI_API_KEY` and `ANTHROPIC_API_KEY` will be removed at handover; client supplies their own. **Action when next touching cover code:** abstract the provider behind an `ImageGenProvider` interface so the swap is a config flip, not a rewrite. Saved as a project memory.

### 3. Regenerate dialog note is collected but ignored for cover (LOW)
Pressing **Regenerate** on the Community Cover module opens the standard dialog asking "What would you like changed?" The note is sent to the API and into the Inngest event as `regenerateNote` — but `generate-cover.ts` does not pass it to `buildImagePrompt`. Net effect: the note has no influence on cover output. Mentioned in `~/.claude/plans/i-forget-if-i-graceful-shell.md`. Plan for a dedicated cover prompt-editor UI was deferred until post-demo.

### 4. Gemini image-preview rate limits are tight (LOW for demo, MEDIUM for prod)
With 3 parallel calls per package, the preview model's RPM cap occasionally throttles → SDK hangs. Mitigation in place (60s timeout + inline retry). For higher-volume usage, request a tier bump on the Gemini project or switch to Ideogram (see #2).

### 5. Cover URLs are public, not signed (TECH DEBT)
`getPublicUrl` is used in `generate-cover.ts:148`. CLAUDE.md mandates signed URLs ("Supabase Storage always via signed URLs. Never expose public bucket URLs."). Pre-existing — not introduced today. **Fix before handover.**

### 6. No Sentry breadcrumbs for cover failures (TECH DEBT)
Generators log to `console`. Inngest's failure handler marks the job row `failed`, but VAs only see the surface state. A Sentry hook (or an Inngest observability integration) would surface these earlier.

### 7. No Canva integration yet
PRD Phase 3. Out of scope for tomorrow's demo; will be the next sprint.

### 8. No pattern library admin UI yet
PRD Phase 4. Out of scope for tomorrow's demo.

---

## Phase status against PRD

| Phase | PRD Status | Actual |
|---|---|---|
| Phase 1 — Foundation + Copy Engine | Build-ready | **✅ Shipped** (4 modules, dashboard, intake) |
| Phase 2 — Visual Engine | Build-ready | **🟡 Partial** — cover only (no icon, no Start Here thumbnail, no Join Now banner) |
| Phase 3 — Canva Integration | Build-ready | **❌ Not started** |
| Phase 4 — Pattern Library Intelligence | Build-ready | **❌ Not started** (read-only fetch from DB exists) |

---

## Recommended demo script (low-risk path)

1. Start on `/creators/new`. Fill the form with a real-feeling creator (use Mario's profile or a stock one).
2. Click **Generate launch package**.
3. Land on the package page. Watch the 5 module cards populate. Talk through the streaming UX while it loads (~30–60s).
4. **Do not click Regenerate** on cover. (Note field is ignored; you'd just spin another ~90s wait for no observable change.)
5. Show the edit-inline UX on one text module. Approve it.
6. Pick a cover variant. Approve.
7. Click through to the export page. Show the copy actions and Skool deployment checklist.

If any module fails mid-demo: refresh the page; Inngest will have logged the error and the module card will show a "Retry" affordance.

---

## How to verify cover generation right now

```bash
# From a browser logged into the deployed app:
# 1. POST to /api/packages with a creatorId → returns packageId
# 2. POST to /api/packages/{packageId}/generate → 202
# 3. Watch /api/packages/{packageId} GET responses (UI polls every 5s)

# From this repo, watch logs in real time via the Vercel MCP:
#   query="gen/cover" since="5m"
# Look for the sequence:
#   createJobRow → variant-1/2/3 calling Gemini → variant-N done → asset inserted
```

End-to-end success criterion: an `asset inserted` log line for module `cover` within ~90s of `createJobRow`.

---

## Repo paths to know

- `src/lib/inngest/functions/generate-cover.ts` — image pipeline (the file that took most of today's work)
- `src/lib/gemini-image/generate.ts` — Gemini SDK wrapper, timeouts, usage logging
- `src/app/api/inngest/route.ts` — Inngest handler, `maxDuration = 300`
- `src/app/api/packages/[id]/modules/[module]/regenerate/route.ts` — Regenerate API
- `src/components/dashboard/module-cards.tsx` — `CoverCard` and other module cards
- `src/components/dashboard/action-dialogs.tsx` — `RegenerateDialog`
- `src/prompts/cover.ts` — image prompt builder (`buildImagePrompt`, `CoverStyle`)
- `PRD.md` — full product spec
- `CLAUDE.md` — engineering rules; read before any structural change

---

**TL;DR:** The build is demo-ready. Cover generation works in 30–90s after today's three-commit fix. Don't press Regenerate live. Roll back the demo-auth bypass before any non-demo audience sees this URL.
