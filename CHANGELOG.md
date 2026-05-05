# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for 1.1.0 — Phase 1.5 features
- Classroom section: covers, titles, descriptions per classroom
- Leaderboard name generator
- Editable image generation prompt (wire up regenerateNote flow + dedicated prompt editor UI)
- "Mark as deployed" state with post-deployment edit capability
- VA deployment checklist visible during copy-paste mode

### Planned for 1.1.0 — Pre-handover hygiene
- Auth bypass gating via `NEXT_PUBLIC_DEMO_MODE` env var
- Migrate cover asset URLs from public to signed
- Introduce `ImageGenProvider` abstraction (Gemini → Ideogram swap as config flip)
- Sentry breadcrumbs on cover generation failures

## [1.0.0] - 2026-05-04

Initial demo release. Live walkthrough delivered to Ramsha Ahmad and Domenic Iandolo (Skool Skale). Phase 1 closed at $5,000.

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
- No `ImageGenProvider` abstraction yet — Gemini is hardcoded; client handover requires refactor
- No Sentry breadcrumbs on cover generation failures

[Unreleased]: https://github.com/CaboAi/skoolskale-builder/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/CaboAi/skoolskale-builder/releases/tag/v1.0.0
