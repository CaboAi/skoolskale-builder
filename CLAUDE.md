# CLAUDE.md — SkoolSkale Community Builder

Project-wide rules every Claude Code agent respects. Read this first on every task.

## Project Overview

A launch-phase Skool community builder for the Skool Skale agency. Internal tool. VAs generate a full community package (copy + images + Canva-autofilled templates) from a creator intake. See `PRD.md` for full product spec.

## Stack (authoritative)

- **Framework:** Next.js 15 (App Router), TypeScript strict mode
- **Database:** Supabase Postgres via Drizzle ORM
- **Auth:** Supabase Auth (magic link)
- **Storage:** Supabase Storage (private buckets)
- **AI copy:** Claude Sonnet 4 via Vercel AI SDK (`streamText`)
- **AI images:** Gemini Nano Banana 2 (`gemini-3.1-flash-image-preview`) via `@google/genai`
- **Image composition:** Native via Gemini reference images (no Sharp for MVP)
- **Background jobs:** Inngest (all long-running work)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Forms:** React Hook Form + Zod
- **Client state:** TanStack Query + Zustand
- **Hosting:** Vercel
- **Monitoring:** Sentry + PostHog

Do not introduce new major dependencies without Mario's approval.

## Architectural Rules

1. **No Claude or Gemini image calls in API routes.** All external AI calls run inside Inngest functions. API routes enqueue jobs and return immediately.
2. **No client-side API keys.** All secrets in Vercel env vars, accessed only from server.
3. **Every new table needs RLS policies.** No exceptions. Test with anon + authed Supabase clients.
4. **Generator prompts live in `/src/prompts/<module>.ts`.** Not in database. Version controlled, reviewed by `prompt-engineer`.
5. **All user input validated with Zod.** Same schema used client + server.
6. **Server components by default.** Client components only when interactive state is needed.
7. **Supabase Storage always via signed URLs.** Never expose public bucket URLs.
8. **Every state-changing action writes to `audit_log`.** Non-negotiable.

## Code Style

- Indentation: 2 spaces
- Imports ordered: node builtins → external → `@/` internals → relative
- File naming: kebab-case (`launch-package-card.tsx`), components PascalCase internally
- Route handlers: `route.ts` in `app/api/` directories
- Colocate tests: `foo.test.ts` next to `foo.ts`
- No default exports for components (named exports only); default exports ok for pages/routes per Next.js convention

## Commit Conventions

Conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `chore:` tooling / config
- `refactor:` code change, no behavior change
- `test:` tests only
- `docs:` docs only
- `prompt:` changes to `/src/prompts/` (triggers prompt review)

Scope optional but encouraged: `feat(intake): add creator photo upload`

## Testing Standards

- **Unit:** Vitest. Business logic, parsers, utilities.
- **Integration:** Vitest + Supabase test container. API routes, DB queries with RLS.
- **E2E:** Playwright. Happy paths per phase gate.
- Minimum 70% coverage on business logic. 100% on generator output parsers.

## Before Any Merge

- Tests pass (`pnpm test`)
- Type check passes (`pnpm typecheck`)
- Lint passes (`pnpm lint`)
- `qa-reviewer` agent has reviewed the diff
- Vercel preview deploys cleanly
- No new Sentry errors in preview

## Agents — When to Use Which

- **database-architect** — anything touching Drizzle schema, migrations, RLS, seed data
- **backend-engineer** — Next.js API routes, server actions, Inngest functions, auth logic
- **frontend-engineer** — React components, forms, dashboards, shadcn work, styling
- **prompt-engineer** — `/src/prompts/` files, pattern library, output parsers, Zod schemas for AI outputs
- **integration-specialist** — Claude API, Gemini image API, Canva Connect, OAuth flows, webhooks
- **qa-reviewer** — tests, PR review, regression checks (invoked before every merge)

If a ticket crosses agent lanes, split it.

## Anti-Patterns (Never Do These)

- ❌ Call Claude or Gemini image API from an API route handler (use Inngest)
- ❌ Put prompts in the database (they live in Git, versioned)
- ❌ Skip RLS "because it's an internal tool" (still required)
- ❌ Import `createClient` from `@supabase/supabase-js` directly in components (use wrappers in `/src/lib/supabase/`)
- ❌ Hard-code pattern library examples (load from DB even for seed data)
- ❌ Use `any` in TypeScript (use `unknown` + narrow, or fix the type)
- ❌ Silent catches (`catch {}` — always log or rethrow)
- ❌ New npm packages without approval

## File Paths — Quick Reference

```
/src/app/                    routes (pages + api)
/src/components/             React components
/src/lib/db/                 Drizzle client + queries
/src/lib/supabase/           Supabase client wrappers
/src/lib/claude/             Claude/AI SDK wrapper
/src/lib/gemini-image/       Gemini image API wrapper
/src/lib/canva/              Canva Connect client
/src/lib/inngest/            Inngest client + functions
/src/prompts/                Generator system prompts
/src/types/schemas.ts        Shared Zod schemas
/drizzle/schema.ts           Database schema (source of truth)
/drizzle/migrations/         Generated migrations
/tests/                      Test files
```

## Escalation

If you hit an architectural decision not covered here, stop and ask Mario. Don't guess.
