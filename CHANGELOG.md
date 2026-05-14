# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Calendar (events) module now models the real Skool shape: each event has a `schedule` discriminated union with `weekly` (`dayOfWeek + time + timezone`) or `one_off` (`date + time + timezone`) variants. New `EventScheduleSchema`, `CalendarEventSchema`, `CalendarEventIntakeSchema`, and `CalendarIntakeSchema` in `src/types/schemas.ts`; `CalendarContentSchema` is now `{events: Array<{title, description, schedule}>}` capped at 10. Schedule storage stays normalized (24-hour `HH:mm`, IANA timezone, `YYYY-MM-DD` for one-off); the new `src/lib/calendar/format-schedule.ts` helper renders "Every Monday at 9:00 AM PST" / "August 8, 2026 at 9:00 AM PST" for cards, export view, and copy buttons. Wizard step 5 gets a new `EventsRepeater` with per-row Recurrence select, conditional Day-of-week-vs-Date inputs, native `<input type="time">` / `<input type="date">`, and a curated IANA timezone dropdown. Calendar generator prompt + parser now emit per-event descriptions (classroom-titles pattern); parsers receive the optional `GeneratorInput` so descriptions stitch with the originating event's schedule by index. Dashboard card, ExportView section, and edit dialog all updated to the events shape; export copy buttons split per-event (Title / Schedule / Description). Deployment checklist item "Named Classroom + Calendar areas" replaced with "Named Classroom area" + "Created Calendar events".
- Signed-URLs migration **Stage 3 of 4** — readers consume signed URLs end to end. `getPackageWithDetails` (in `src/lib/db/packages.ts`) now batch-signs every image-module variant's `storagePath` via a new `resolveAssetUrls` helper at `src/lib/storage/resolve-variants.ts`, rewriting `content.variants[].url` to a fresh `/object/sign/...?token=...` URL on every read. A sibling `getPackageWithDetailsRaw` returns the un-rewritten rows for write paths. PATCH and PUT module routes sign on response only (DB rows keep `storagePath` intact). New module→bucket registry at `src/lib/storage/module-buckets.ts`. New download-redirect route `GET /api/packages/[id]/assets/[module]/[index]/download` re-signs with a 60s TTL on every click and 302s to the storage URL with `?download=<filename>` so Supabase serves `Content-Disposition: attachment` (avoids the cross-origin `<a download>` no-op). `ExportView`'s download buttons are now plain `<a>` to the route — client-side fetch/Blob plumbing removed. Inngest cover generator now reads creator photos via `supabase.storage.download()` against `creator_photo_path` (service role, no URL needed) — survives Stage 4 unchanged. `next.config.ts` `images.remotePatterns` extended to allow `/storage/v1/object/sign/**` (keeps `/public/**` during the migration window). `force-dynamic` set on the dashboard + export pages and the affected API routes so cached HTML/RSC payloads can't carry stale signed-URL tokens. Buckets stay public in Stage 3; Stage 4 flips visibility now that every reader has been switched. See `memory/signed-urls-migration-stage-3.md`.
- Signed-URLs migration **Stage 1 of 4** — purely additive backfill of storage paths alongside existing public URLs. New `creator_photo_path` column on `creators` (Drizzle migration `0007_creator_photo_path`). New `scripts/backfill-storage-paths.ts` (run via `pnpm backfill:storage-paths`) parses every persisted public URL in `generated_assets.content.variants[*].url` and `creators.creator_photo_url`, extracts the bucket-relative path, and writes it to `storagePath` / `creator_photo_path`. Idempotent and best-effort: rows already containing the new field are skipped, unparseable URLs are logged and left alone. No app behaviour changes in this stage. See `memory/signed-urls-migration.md` for the full 4-stage plan.
- Delete-package action on the home library list. Each row gets a trash icon that opens a confirmation dialog; on confirm the row is optimistically removed and `DELETE /api/packages/[id]` purges storage objects under the package id in both image buckets (`cover-variants` + `image-variants`) and deletes the `launch_packages` row (cascading `generated_assets` and `generation_jobs`). Workspace-wide per the existing access model; the action is recorded in `audit_log`.
- "Packages" nav link in `AppHeader`, rendered between the wordmark and the theme toggle for authenticated users only. Routes to the home library (`/`).
- Wizard step 5 ("Launch package add-ons") capturing classroom title/description, calendar title/description, 9 leaderboard level names, 3 categories (name + description), and up to 11 Discovery search keywords.
- New module schemas in `src/types/schemas.ts`: `ClassroomContentSchema`, `CalendarContentSchema`, `LeaderboardContentSchema` (9-tuple), `CategoriesContentSchema` (3-tuple), `DiscoverySeoContentSchema` (1-11 keywords).
- Shared form components: `RepeaterField` (single + grouped variants) and `KeywordChipField` (Enter/comma to add, max enforcement, dedupe).
- Module registry entries for `classroom`, `calendar`, `leaderboard`, `categories`, `discovery_seo`.
- `pnpm db:generate` script.
- DOM testing infrastructure (`@testing-library/react` + `jsdom`). Component-level tests now possible alongside existing pure-logic tests under `tests/unit/`.
- Generators (Claude prompts + Inngest functions) for the 5 text add-on modules. Package generation now produces 10 modules end-to-end (5 originals + 5 add-ons).
- Dashboard cards (`LeaderboardCard`, `CategoriesCard`, `DiscoverySeoCard`) and edit forms (`TitleDescriptionEditForm`, `LeaderboardEditForm`, `CategoriesEditForm`, `DiscoverySeoEditForm`); `TextModuleCard` extended to render `{title, description}` for classroom + calendar.
- ExportView sections + Copy-as-CSV button for Discovery keywords; deployment checklist gains 4 add-on items.
- Module registry `hasVariants?: boolean` field; `cover.hasVariants = true` (PR #7 will set the same on `icon` and use it to drive a generic `/select-variant/` route).

### Changed
- `module` enum extended with five add-on values (`classroom`, `calendar`, `leaderboard`, `categories`, `discovery_seo`).
- `creators` table gains nullable add-on columns: `classroom_intake`, `calendar_intake`, `leaderboard_levels`, `categories`, `discovery_keywords`.
- Orchestrator `FUNCTIONS` map relaxed to `Partial<Record<ModuleKey, ...>>`; throws if a `includedByDefault: true` module has no function entry.
- The 5 text add-on modules flipped from `includedByDefault: false` to `true` now that their generators are wired. Package generation now fans out to 10 modules in parallel.

### Refactor
- Module registry pattern; all modules configured in src/lib/modules/registry.ts instead of hardcoded switch statements.

### Fixed
- De-flaked `tests/unit/gemini-image/generate.test.ts` under parallel suite load. Failure mode was Vitest's 5s per-test default firing on the first test due to microtask scheduling contention across workers — not the SUT's 120s `withTimeout` ceiling. File-level `vi.setConfig({ testTimeout: 15_000 })` gives headroom without masking real hangs.
- Regenerate dialog no longer leaks the previous module's prompt note across opens. Submitting the dialog calls `setRegenDialog({ module: null })` from the mutation's `onSuccess`, which forces `open=false` by prop without firing Radix's `onOpenChange` — the dialog's internal `note` state survived, so opening a second module showed the prior note in the textarea. The fix keys `<RegenerateDialog>` by `regenDialog.module` at the call site in `PackageDashboard.tsx`, so React remounts a fresh component per module-open. Covered by a new DOM test in `tests/dom/components/dashboard/RegenerateDialog.test.tsx`.
- `src/lib/storage/parse-public-url.ts` no longer carries the `import "server-only"` directive. The function is pure string manipulation (no secrets, no DB, no env reads) so the directive served no purpose, and it caused `pnpm backfill:storage-paths` to throw immediately when `tsx` loaded the module outside the Next bundle. Stage 1 backfill is unblocked.
- Export readiness check now ignores modules registered with `includedByDefault: false` (e.g., the v1.1 add-ons before their generators land in PR #5).

### Planned
- Classroom section: covers, titles, descriptions per classroom
- Leaderboard name generator
- Editable image generation prompt (wire up regenerateNote flow + dedicated prompt editor UI)
- "Mark as deployed" state with post-deployment edit capability
- VA deployment checklist visible during copy-paste mode

### Hardening
- Production safety gate in `src/lib/env.ts`: reject `DEMO_MODE` truthy when `VERCEL_ENV=production`
- Test coverage for the existing demo-mode bypass in `proxy.ts`, `demo-session.ts`, and the env schema
- Migrate cover asset URLs from public to signed
- Note: alternate image-gen providers were researched (Imagine Art) and deferred.
- Sentry breadcrumbs on cover generation failures

## [1.0.0] - 2026-05-04

Initial demo release. Live walkthrough delivered to Ramsha Ahmad and Domenic Iandolo (Skool Skale).

### Added
- Creator intake form at `/creators/new` capturing niche, audience, course details, brand preferences
- Launch package generation pipeline: 5 modules generate in parallel via Inngest
  - `welcome_dm` (Claude Sonnet 4.6)
  - `transformation` (Claude Sonnet 4.6)
  - `about_us` (Claude Sonnet 4.6)
  - `start_here` (Claude Sonnet 4.6)
  - `cover` (Gemini 3.1 Flash Image Preview, 3 variants in parallel)
- Per-module dashboard with edit, regenerate, and approve actions
- Cover variant selector (choose 1 of 3)
- Export page with copy-paste-ready outputs and Skool deployment checklist
- Demo-mode auto-session for client walkthroughs (to be gated in 1.1.0)

### Infrastructure
- Next.js 15 App Router with TypeScript strict mode
- Supabase: Postgres + Drizzle ORM + Auth (magic link) + Storage
- Claude Sonnet 4.6 via Vercel AI SDK
- Gemini 3.1 Flash Image Preview via `@google/genai`
- Inngest for all long-running AI work (zero AI calls in API routes)
- Vercel hosting with automatic preview deployments per branch

### Fixed during demo prep
- Cover generation: split single Gemini step into durable per-variant Inngest steps to survive Vercel timeouts (`4364928`)
- Cover generation: 60s `Promise.race` timeout on Gemini calls + `AbortSignal.timeout` on reference fetch (`d43dff9`)
- Cover generation: replaced Inngest exponential backoff with inline 2-attempt retry; tightened Gemini timeout 90s → 60s (`b29e3ef`)
- start_here parser schema alignment (`aac7a8c`)

### Known limitations (carried forward, slated for 1.1.0)
- Demo-mode auth bypass active in production (`eed3533`, `fc0a033`, `199a170`)
- Cover asset URLs are public, not signed (violates internal CLAUDE.md storage rule)
- Gemini is the only image-gen provider wired up; alternate providers deferred.
- No Sentry breadcrumbs on cover generation failures

[Unreleased]: https://github.com/CaboAi/skoolskale-builder/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/CaboAi/skoolskale-builder/releases/tag/v1.0.0
