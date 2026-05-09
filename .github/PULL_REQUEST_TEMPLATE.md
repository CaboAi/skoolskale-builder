<!--
PR template for skoolskale-builder. Delete sections that don't apply.
The "Manual infra steps" section is mandatory — every PR has to answer it,
even if the answer is "no infra changes". Lying here costs a smoke run.
-->

## Summary

<!-- One paragraph: what changed, why. Link issues / PRDs / log entries. -->

## Manual infra steps required before merge

`.env.local` and Vercel point at the same Supabase project. Migrations and bucket scripts in this repo do **not** auto-apply on deploy. If this PR touches `drizzle/` or `scripts/setup-storage.ts`, you have to apply them manually before (or right after) merge — see `CLAUDE.md` § "Migration & Storage Setup" for the exact commands and verification steps.

- [ ] **No migration changes in this PR** — OR — **Migration applied to prod** via `npx dotenv -e .env.local -- drizzle-kit migrate` and verified via `pnpm verify:enum` (or relevant script)
- [ ] **No new storage bucket in this PR** — OR — **Storage bucket created in prod** via `pnpm storage:setup` and verified via `pnpm verify:bucket`
- [ ] No new server env vars required — OR — env vars set in Vercel for all environments (Preview + Production)

## Test plan

<!--
Bulleted checklist of TODOs for testing this PR on Vercel preview.
Be specific — "deploy works" doesn't count. What user-visible thing
should change, and how do you confirm it?
-->

- [ ] `pnpm test` clean
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean (0 errors, 0 warnings)
- [ ]
- [ ]

## Out of scope

<!-- What this PR is intentionally NOT addressing, with links/refs to where it will be picked up. -->
