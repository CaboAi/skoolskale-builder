# SkoolSkale Community Builder — Product Requirements Document

**Version:** 1.0
**Stack:** Next.js 15 · Supabase · Claude API · Inngest · Vercel
**Build approach:** Claude Code + six specialized subagents
**Prepared by:** Mario Polanco
**Status:** Build-ready

---

## 1. Product Overview

The SkoolSkale Community Builder is an internal operations tool for Skool Skale. It takes a creator's onboarding responses and produces a complete launch-phase Skool community package — all copy assets, all visual assets, and Canva-autofilled branded templates — in under 15 minutes of VA time. What is currently 9–14 hours of scattered manual work across copywriting, Canva design, and Skool setup becomes a guided one-session workflow.

The system combines a structured intake form, an AI generation pipeline (copy + images), a VA review-and-approve dashboard, direct integration with Canva for branded template autofill, and a deployment handoff flow into Skool.

### Success criteria

- **Time to launch package:** <15 VA-minutes from intake submission (vs. 9–14 hours today)
- **Output quality:** VA accepts 80%+ of generated copy without rewriting
- **Design rework:** Client-driven cover revisions drop from 4–7 hours to <30 minutes
- **Adoption:** 100% of new Skool Skale community launches run through the tool within 30 days of launch
- **Quality retention:** Post-launch member engagement metrics match or exceed hand-built communities

### Non-goals (explicit)

- Not a member-facing product
- Not ongoing community operations (content calendars, engagement, support)
- Not VSL production (creator-recorded, stays manual)
- Not a general-purpose copywriting tool (Skool Skale-specific patterns only)
- Not a CRM replacement (coexists with GHL from the separate Phase 1 engagement)

---

## 2. Scope

The build covers four phases, all in scope. Each phase ships independently and is deployable on its own.

| Phase | Name | Weeks | Primary Deliverable |
|---|---|---|---|
| **Phase 1** | Foundation + Copy Engine | 1–2 | Intake form + 4 copy generators + review dashboard |
| **Phase 2** | Visual Engine | 3–4 | 4 image generators (cover, icon, Start Here thumbnail, Join Now banner) |
| **Phase 3** | Canva Integration + Workflow | 5–6 | Canva Connect autofill + per-client template library + deployment handoff |
| **Phase 4** | Pattern Library Intelligence | 7–8 | Feedback loop, quality metrics, self-improving generators |

---

## 3. User Personas

### Primary: The VA (Meg, Samuel, future hires)

Runs one session per new community. Moderate technical comfort. Lives in Skool, Canva, Slack, Monday. Needs outputs that are 80% right out of the gate; accepts inline editing but rejects "start from scratch." Primary UI consumer.

### Secondary: Leadership (Ramsha, Domenic)

Reviews and approves packages before deployment for strategic clients. Sets tone and quality standards. Overrides AI output when brand voice matters. Has admin permissions: edit pattern library, manage per-client Canva templates, view analytics.

### Tertiary: Mario (builder)

Post-delivery: monitors error rates, tunes prompts, ships new pattern library examples as Ramsha provides them.

---

## 4. Core User Flows

### 4.1 Happy Path (New Community Launch)

```
1. VA logs in → Dashboard (list of in-progress packages)
2. VA clicks "New Community"
3. VA completes intake form (creator info, offer, tone, brand prefs, photo upload)
4. VA clicks "Generate launch package"
5. Inngest dispatches parallel generation jobs:
   - 4 copy modules stream into dashboard as they complete (Claude streaming)
   - 4 image modules complete within 60–120s (Gemini batch)
6. Review dashboard populates module by module
7. VA for each module: approve / edit inline / regenerate with note
8. When all modules approved → "Push to Canva" button enables
9. Canva Connect API autofills the client's branded templates with:
   - Cover art + community name + tagline
   - Start Here thumbnail with creator photo
   - Join Now banner with pricing + trial callout
10. VA receives Canva file URLs in dashboard — opens, makes any final tweaks
11. VA exports copy blocks (copy-to-clipboard) + image files
12. VA follows deployment checklist → Skool community live
13. Package marked "Deployed" → metrics logged
```

### 4.2 Revision Flow (Client Rejects Cover)

```
1. VA opens existing package, clicks "Regenerate cover"
2. Dialog: "What would you like changed?" (freeform note)
3. Gemini generates 3 new variants with the note incorporated
4. VA approves new variant → re-pushes to Canva (overwrites or versions)
5. Revision logged for pattern library learning
```

### 4.3 Pattern Library Improvement Flow (Admin)

```
1. Ramsha opens admin area → Pattern Library
2. Views ranked examples per module (rated by VA "this was great" feedback)
3. Can add new examples (paste past community assets)
4. Can deprecate weak examples
5. Changes take effect on next generation
```

---

## 5. Feature Specifications

### 5.1 Intake Form (Phase 1)

**Multi-step wizard** (saves draft state every 30s to Supabase):

**Step 1 — Creator & Community**
- Creator name
- Community name
- Niche (spiritual / business / fitness / relationships / money / yoga / other)
- Creator photo upload (Supabase Storage, private bucket)
- Support contact name (for Welcome DM merge tag)

**Step 2 — The Offer**
- Core transformation / promise (textarea, raw input ok)
- Target audience (textarea)
- Offer breakdown (structured):
  - Courses (repeating field: name + description)
  - Live calls (schedule)
  - Perks (bullet list)
  - Events (recurring + one-off)
  - Guest sessions (Y/N, frequency)
- Pricing (monthly / annual / tiers)
- Trial terms (Y/N, duration)
- Refund policy

**Step 3 — Voice & Brand**
- Tone preference (loving / direct / playful)
- Brand preferences (colors, vibe, aesthetic refs, or "surprise me")
- Example creators they admire (optional, informs tone mirroring)

**Step 4 — Review & Generate**
- Full intake preview
- "Generate launch package" CTA

### 5.2 Copy Generator Modules (Phase 1)

Each generator is an independent Claude API call with its own system prompt, pattern library injection, and output schema. Modules run in parallel via Inngest.

#### Module C1: Welcome DM
- **Input:** creator name, community name, tone, support contact
- **Output:** DM text (80–120 words) with `#NAME#` and `#GROUPNAME#` merge tags
- **Pattern library source:** 3+ real examples per tone (loving, direct, playful)
- **Regenerate options:** shorter / more playful / more loving / freeform note

#### Module C2: Transformation Line
- **Input:** transformation, audience, niche
- **Output:** 3 candidate taglines (6–12 words each), VA picks one
- **Pattern library source:** 10+ example lines from past communities
- **Constraint:** Must read as "before → after" compressed

#### Module C3: About Us Page ("Why Join")
- **Input:** selected transformation line, offer breakdown, pricing, trial terms
- **Output:** Full About Us following Skool Skale's emoji-bucket structure
- **Pattern library source:** 5+ full About Us pages
- **Regenerate options:** section-by-section (hero, value buckets, pricing block)

#### Module C4: Start Here Course
- **Input:** community name, creator name, support contact, tone, niche
- **Output:** Full 4-step Start Here:
  1. How to Use the Community (mostly template, minimal variation)
  2. Community Rules (tone-adapted)
  3. 7 standard FAQs (questions fixed, answers tone-adapted)
  4. Need Assistance (contact info)
- **Pattern library source:** Reality Revolution Start Here + tone-adapted variants

### 5.3 Image Generator Modules (Phase 2)

#### Module I1: Community Cover (3 variants)
- **Input:** creator photo, community name, transformation line, brand preferences
- **Output:** 3 cover variants (1456×816 px, Skool cover spec)
- **Pipeline:** Gemini Nano Banana 2 generates variants with creator photo as reference image → Supabase Storage. No server-side compositing needed — the model handles it natively.

#### Module I2: Community Icon (3 variants)
- **Input:** community name, transformation line, brand preferences
- **Output:** 3 icon variants (512×512 px)
- **Pipeline:** Gemini Nano Banana 2 generates text-forward logo concepts

#### Module I3: Start Here Thumbnail (3 variants)
- **Input:** creator photo, brand preferences
- **Output:** 3 thumbnail variants with "START HERE" text + arrow graphic + creator photo
- **Reference patterns:** Brian Scott, Laura Joan Cornell styles

#### Module I4: Join Now Banner (3 variants)
- **Input:** creator community card preview, trial terms, brand preferences
- **Output:** 3 banner variants with "JOIN NOW" + trial CTA + community card
- **Reference patterns:** Reality Revolution, Story Medicine styles

### 5.4 Review Dashboard (Phase 1 + Phase 2)

Single-page dashboard with streaming updates. Header shows package status, progress %, CTA to next step.

Each module renders as a **card** with:
- Generated output (text preview or image gallery)
- **Edit** button → inline rich-text editor for copy, variant selector for images
- **Regenerate** button → dialog with optional note, shows variant history
- **Approve** checkbox
- **Notes** field (VA annotations — fed back into pattern library)

**Behavior:**
- Copy modules stream in live (Vercel AI SDK `useCompletion`)
- Image modules show skeleton loader → reveal when Inngest job completes
- Regeneration happens in-place, preserves previous version in history
- "Push to Canva" CTA enabled only when all modules approved

### 5.5 Canva Integration (Phase 3)

#### Per-Client Template Library (admin feature)

Admin UI where Ramsha/Mario register each client's branded Canva templates:
- Template ID (from Canva)
- Template type (cover / icon / thumbnail / banner)
- Variable map (which Canva variables correspond to which generator outputs)
- Client association

Supported via **Canva Connect API** — requires OAuth flow per admin.

#### Autofill Workflow

When VA clicks "Push to Canva":
1. System looks up client's template library
2. For each approved asset, call Canva Connect `/autofills` endpoint with generator output as variable values + generated image as asset reference
3. Canva returns design URLs
4. Dashboard displays links to each Canva file
5. VA clicks through to Canva, does final polish, downloads finals

#### Fallback

If a client has no branded templates registered, dashboard presents a **manual download bundle** (raw generator images + copy blocks). VA handles Canva manually.

### 5.6 Deployment Handoff (Phase 3)

After Canva work:
- Export page with copy-to-clipboard for every Skool admin field
- Download links for all final visual assets
- **Deployment checklist** — step-by-step Skool admin instructions
- "Mark as deployed" button → moves package to Deployed status, logs metrics

### 5.7 Pattern Library Intelligence (Phase 4)

#### Feedback Capture

Each VA interaction captured:
- Module approved without edit (quality signal +1)
- Module edited inline (quality signal +0, diff logged)
- Module regenerated (quality signal −1, regenerate note logged)
- VA notes on module (quality signal, qualitative)

#### Quality Scoring

Nightly cron (Supabase edge function):
- Computes per-module quality score (approval rate, edit distance, regen rate)
- Ranks pattern library examples by how often they're used in high-performing generations
- Flags underperforming examples for admin review

#### Self-Improvement Loop

- Top-rated generated outputs (VA-approved, zero edits, client-launched successfully) auto-nominated for pattern library inclusion
- Admin reviews weekly, promotes best → library
- Generators automatically get richer few-shot examples over time

---

## 6. Technical Architecture

### 6.1 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Server components + streaming AI native. Your default. |
| **Language** | TypeScript (strict) | End-to-end type safety with Zod. |
| **Styling** | Tailwind CSS v4 | Your default. |
| **UI Components** | shadcn/ui | Production-grade components without design debt. |
| **Forms** | React Hook Form + Zod | Shared schemas between client/server. Type-safe. |
| **State (client)** | TanStack Query + Zustand | Server state (TanStack Query), local UI state (Zustand). |
| **Database** | Supabase Postgres | Your default. RLS, storage, auth, realtime in one. |
| **ORM** | Drizzle | Type-safe queries. Drizzle-Kit for migrations. Better DX than raw Supabase client for complex queries. |
| **Auth** | Supabase Auth (magic link) | Email allowlist for team-only access. |
| **Storage** | Supabase Storage | Creator photos + generated assets. Private buckets with signed URLs. |
| **AI (copy)** | Claude Sonnet 4 via Vercel AI SDK | `streamText` for dashboard streaming. One-line integration. |
| **AI (images)** | Gemini Nano Banana 2 (`gemini-3.1-flash-image-preview`) via `@google/genai` SDK | Best text-in-image quality for covers (94%+ accuracy on "JOIN NOW" / "START HERE" text). Native reference-image support lets us pass the creator photo directly — no server-side compositing needed. 4K output available. $0.045/image. |
| **Image compositing** | _Skipped for MVP._ Gemini's reference-image support replaces the need for Sharp. If output quality demands it later, Sharp gets added in Phase 2. | Reduces dependency surface, native binary builds, and complexity. |
| **Background jobs** | Inngest | Durable execution for generation pipelines. Retries, parallelism, step functions. Critical — Vercel 60s timeout will break without this. |
| **External integrations** | Canva Connect API | Per-client template autofill. OAuth flow. |
| **Hosting** | Vercel | Your default. Inngest integrates seamlessly. |
| **Error monitoring** | Sentry | Server + client errors + performance. |
| **Analytics** | PostHog | Product analytics — track which modules get regenerated most. |
| **CI/CD** | GitHub Actions + Vercel | Auto-deploy `main`. PR previews. |
| **Dev environment** | Claude Code | Six specialized subagents (see §8). |

### 6.2 Recommended alternatives to your default stack

**Three net-new tools to add beyond your usual setup:**

1. **Inngest** — non-negotiable. Without it, image generation will silently time out on Vercel. Inngest also gives you step functions (image gen → composite → upload → update DB as separate retriable steps) and a visual debugger when things break. ~$0/mo at launch volume.

2. **Drizzle ORM** — instead of raw Supabase client queries. You get full TypeScript inference on queries, proper migration tooling, and a sane ORM for complex joins (there are several in this data model). Works perfectly with Supabase Postgres.

3. **shadcn/ui + TanStack Query** — if you're not already using these. Dashboard has real client-side state (streaming outputs, edit mode, regeneration queue) that benefits from proper data fetching patterns instead of ad-hoc `useEffect`.

**One thing to consider swapping:**

Your default of **raw Vercel API routes for Claude** → **Vercel AI SDK's `streamText`**. The AI SDK handles streaming, tool use, and provider switching with far less code. You won't regret it.

### 6.3 Data Model

```
users                        (Supabase Auth managed — don't duplicate)
  id, email, role, created_at

creators
  id (uuid)
  name (text)
  community_name (text)
  niche (enum)
  audience (text)
  transformation (text)
  tone (enum: loving|direct|playful)
  offer_breakdown (jsonb)
  pricing (jsonb)
  trial_terms (jsonb)
  refund_policy (text)
  brand_prefs (text)
  creator_photo_url (text)
  created_by (uuid fk → users.id)
  created_at, updated_at

launch_packages
  id (uuid)
  creator_id (uuid fk → creators.id)
  status (enum: draft|generating|review|ready|deployed|archived)
  progress_pct (int)
  total_cost_usd (numeric)  -- sum of all API calls
  generation_duration_ms (int)
  created_at, exported_at, deployed_at

generated_assets
  id (uuid)
  package_id (uuid fk → launch_packages.id)
  module (enum: welcome_dm|transformation|about_us|start_here|cover|icon|start_here_thumb|join_now_banner)
  version (int)
  content (jsonb)  -- text or image metadata + URL
  approved (bool, default false)
  approved_by (uuid fk → users.id, nullable)
  approved_at (timestamptz, nullable)
  edit_history (jsonb[])  -- versions with timestamps + author
  va_notes (text)
  quality_score (numeric, nullable)  -- populated by Phase 4
  created_at

generation_jobs                (Inngest-correlated)
  id (uuid)
  package_id (uuid fk)
  module (enum)
  status (enum: queued|running|done|failed|cancelled)
  inngest_run_id (text)
  claude_usage (jsonb, nullable)  -- tokens, cost
  gemini_image_usage (jsonb, nullable)
  error (text, nullable)
  started_at, completed_at

pattern_library
  id (uuid)
  module (enum — matches generated_assets.module)
  niche (enum, nullable — null = universal)
  tone (enum, nullable — null = universal)
  example_content (jsonb)
  source_creator (text, nullable)
  source_package_id (uuid fk, nullable — if promoted from a past generation)
  quality_rank (int, default 50)
  is_active (bool, default true)
  created_at, promoted_at

canva_template_registry
  id (uuid)
  client_name (text)
  template_type (enum: cover|icon|thumbnail|banner)
  canva_template_id (text)
  variable_map (jsonb)  -- maps generator outputs to Canva variables
  created_by, created_at

canva_generations
  id (uuid)
  package_id (uuid fk)
  module (enum)
  canva_template_id (text)
  canva_design_url (text)
  autofill_payload (jsonb)
  created_at

feedback_events               (Phase 4)
  id (uuid)
  asset_id (uuid fk → generated_assets.id)
  event_type (enum: approved_clean|edited|regenerated|deprecated)
  edit_distance (int, nullable)
  regenerate_note (text, nullable)
  va_note (text, nullable)
  created_at

audit_log
  id, user_id, action, entity_type, entity_id, payload (jsonb), created_at
```

### 6.4 API Design

All routes server-side. Route group `(authenticated)` for logged-in. Admin routes under `/api/admin/*` with role check middleware.

```
# Creators
POST   /api/creators
GET    /api/creators
GET    /api/creators/:id
PATCH  /api/creators/:id

# Packages  
POST   /api/packages
GET    /api/packages
GET    /api/packages/:id
POST   /api/packages/:id/generate
POST   /api/packages/:id/cancel

# Generated assets
PATCH  /api/packages/:id/modules/:module              (edit)
POST   /api/packages/:id/modules/:module/regenerate   (new version)
POST   /api/packages/:id/modules/:module/approve
DELETE /api/packages/:id/modules/:module/approve      (unapprove)
GET    /api/packages/:id/modules/:module/history

# Canva
POST   /api/packages/:id/canva/push                   (autofill all approved assets)
GET    /api/packages/:id/canva/generations
POST   /api/admin/canva/oauth/start
GET    /api/admin/canva/oauth/callback
POST   /api/admin/canva/templates                     (register template)
GET    /api/admin/canva/templates

# Export
GET    /api/packages/:id/export                       (returns bundle URL)

# Pattern library (admin)
GET    /api/admin/patterns
POST   /api/admin/patterns
PATCH  /api/admin/patterns/:id
DELETE /api/admin/patterns/:id
POST   /api/admin/patterns/promote-from-asset/:asset_id

# Webhooks
POST   /api/webhooks/inngest                          (Inngest callback)
POST   # (no async webhook — Gemini image gen is synchronous)

# Analytics (admin)
GET    /api/admin/metrics/generations
GET    /api/admin/metrics/quality
GET    /api/admin/metrics/costs
```

### 6.5 Security & Access Control

- **Authentication:** Supabase Auth magic link. Email allowlist table checked on signup.
- **Authorization:** Two roles — `va` and `admin`. RLS policies on every table. Admin routes protected by middleware.
- **Secrets:** All API keys in Vercel env vars. Never in client bundles. Claude/Gemini/Canva keys on server only.
- **Storage:** Creator photos in private Supabase bucket. Signed URLs with 1-hour expiry for frontend display.
- **PII:** No creator/member PII beyond what's needed (names, emails). No payment data — never touches the app.
- **Audit log:** Every state-changing action logged for compliance and debugging.

### 6.6 Observability

- **Sentry:** All errors server + client. Source maps uploaded on deploy.
- **PostHog:** Events: `package_created`, `generation_started`, `module_approved`, `module_edited`, `module_regenerated`, `package_deployed`. Funnel analysis on completion rate.
- **Inngest dashboard:** Generation job visibility, retry history, step timing.
- **Vercel Analytics:** Web vitals, route-level performance.
- **Custom dashboard (admin):** Per-module quality scores, average generation cost, VA throughput.

### 6.7 Failure Modes & Mitigations

| Failure | Mitigation |
|---|---|
| Claude API timeout / error | Inngest step retries (3 attempts, exponential backoff). Module marked failed, VA can retry manually. |
| Gemini API rate limit | Inngest concurrency limit (3 parallel jobs max). Queue depth visible in dashboard. |
| Vercel function timeout | All generation runs in Inngest (not in API route). API routes just enqueue. |
| Canva Connect OAuth expired | Detect 401, prompt admin to re-auth. Package stays in "ready" state, autofill retryable. |
| Creator photo upload fails | Validation on upload. Retry with signed URL. Fallback: generate cover without creator photo (brand-only). |
| Supabase downtime | Degrade gracefully: read-only mode if DB unreachable, show status banner. |
| Pattern library empty for a niche | Fall back to universal examples (niche = null). Never block generation. |

---

## 7. AI Generator Specifications

### 7.1 Prompt Engineering Standards

All generator prompts follow this structure:

```typescript
// /src/prompts/<module>.ts

export const systemPrompt = `
You are a specialist in <module purpose> for Skool communities.

<Role context and what makes a great output>

<Hard rules — what to always do / never do>

<Output format specification — JSON schema or structured text>
`;

export function buildUserMessage(input: GeneratorInput): string {
  return `
<Pattern library examples — 3 relevant examples based on niche + tone>

<Creator context injected from intake>

<Specific ask for this generation, including any regenerate notes>
`;
}

export function parseOutput(raw: string): ModuleOutput {
  // Structured extraction, validation via Zod
}
```

Prompts versioned in Git. Changes require a PR and `prompt-engineer` agent review.

### 7.2 Pattern Library Injection

For each generation:
1. Query `pattern_library` filtered by module + niche + tone, ordered by `quality_rank` desc
2. Take top 3 (or top 5 if tokens allow)
3. Inject as few-shot examples in user message
4. If empty for niche, fall back to niche=null universals

### 7.3 Output Validation

Every generator output must pass:
- Zod schema validation
- Length constraints (e.g., Welcome DM: 80–120 words)
- Content safety check (no broken merge tags, no lorem ipsum, no "I cannot generate...")
- Module-specific checks (e.g., About Us must contain all required sections)

Failed validation → auto-regenerate once, then surface to VA with error.

---

## 8. Agent Team Structure

The build is executed by six specialized Claude Code subagents. Mario dispatches tickets to agents via Claude Code's Task tool. Each agent has a focused system prompt, constrained tool access, and stays in its lane.

### 8.1 Agent Roster

| Agent | Domain | Primary Tools |
|---|---|---|
| **database-architect** | Supabase schema, Drizzle migrations, RLS policies, seed data | Read, Write, Edit, Bash |
| **backend-engineer** | Next.js API routes, server actions, Inngest functions, auth flows | Read, Write, Edit, Bash |
| **frontend-engineer** | React components, dashboards, forms, shadcn, Tailwind | Read, Write, Edit, Bash |
| **prompt-engineer** | Generator prompts, pattern library curation, output parsing | Read, Write, Edit |
| **integration-specialist** | Third-party APIs (Claude, Gemini Image, Canva Connect), OAuth flows, webhooks | Read, Write, Edit, Bash |
| **qa-reviewer** | Tests (Vitest, Playwright), PR review, regression checks, output validation | Read, Bash |

All agent definitions are shipped as files in `.claude/agents/`. Mario invokes them via Claude Code's Task tool:

> "Use the `database-architect` subagent to implement the `pattern_library` table migration with RLS policies."

### 8.2 Coordination Rules

- **Mario is tech lead.** He decomposes epics into tickets, routes to agents, resolves cross-agent conflicts.
- **Agents stay in lane.** If work crosses domains, split the ticket.
- **All merges pass through `qa-reviewer`.** No exceptions.
- **`CLAUDE.md` at project root carries shared rules** every agent respects (code style, commit conventions, file layout, anti-patterns).
- **Agents write and update tests as part of their work.** `qa-reviewer` validates coverage and scenarios.

### 8.3 Agent Collaboration Patterns

| Pattern | When | Example |
|---|---|---|
| **Sequential** | Ticket has clear dependency | `database-architect` ships migration → `backend-engineer` builds API routes against it |
| **Parallel** | Independent tickets | `frontend-engineer` builds intake form while `prompt-engineer` writes generator prompts |
| **Pair** | Domain-adjacent ticket | `backend-engineer` + `integration-specialist` on Inngest function that calls Claude |
| **Review** | Always before merge | `qa-reviewer` reads diff, runs tests, approves or rejects |

---

## 9. Build Plan

### Phase 1 — Foundation + Copy Engine (Weeks 1–2)

**Sprint 0: Project Setup (Day 1)** — Mario manual
- `create-next-app` with TypeScript, Tailwind v4, App Router
- Install shadcn, Vercel AI SDK, Inngest SDK, Drizzle, Zod, React Hook Form, TanStack Query
- Initialize Supabase project + env vars
- Initialize Vercel project + GitHub integration
- Set up Sentry + PostHog
- Drop `.claude/agents/` + `CLAUDE.md` into repo
- First commit, verify Vercel preview deploys

**Sprint 1: Database Foundation (Days 2–3)**
- `database-architect`: Drizzle schema for all tables in §6.3 (except Phase 3/4-only tables)
- `database-architect`: RLS policies on creators, launch_packages, generated_assets
- `database-architect`: Seed script loading Ramsha's provided patterns into `pattern_library`
- `backend-engineer`: Supabase Auth setup, magic link flow, email allowlist middleware
- `backend-engineer`: Session handling + role helpers
- `qa-reviewer`: Schema review + RLS test suite

**Sprint 2: Intake Form (Days 4–5)**
- `frontend-engineer`: Multi-step wizard with React Hook Form + Zod
- `frontend-engineer`: Creator photo upload to Supabase Storage with signed URL retrieval
- `frontend-engineer`: Draft autosave (debounced PATCH every 30s)
- `backend-engineer`: `/api/creators` CRUD routes
- `qa-reviewer`: Form validation tests, storage upload tests

**Sprint 3: Copy Generators (Days 6–9)**
- `prompt-engineer`: System prompts for C1 (Welcome DM), C2 (Transformation), C3 (About Us), C4 (Start Here)
- `prompt-engineer`: Pattern library injection helpers
- `prompt-engineer`: Zod schemas for generator output + parsers
- `integration-specialist`: Vercel AI SDK integration, Claude client wrapper, cost/usage tracking
- `backend-engineer`: Inngest functions per module with retry logic
- `backend-engineer`: Fan-out function: "generate package" kicks off all 4 copy modules in parallel
- `backend-engineer`: `/api/packages/:id/generate` endpoint + module-level regenerate routes
- `qa-reviewer`: End-to-end test: intake → generate → 4 assets populated in DB

**Sprint 4: Review Dashboard v1 (Days 10–12)**
- `frontend-engineer`: Dashboard layout with shadcn cards
- `frontend-engineer`: Streaming copy rendering via Vercel AI SDK `useCompletion`
- `frontend-engineer`: Inline rich-text editor per module (Tiptap or similar)
- `frontend-engineer`: Regenerate dialog with note input
- `frontend-engineer`: Approve/unapprove state + progress header
- `frontend-engineer`: Version history viewer
- `qa-reviewer`: Playwright flow test (full happy path with mocked generation)

**Phase 1 Gate:** Demo-able. VA can intake → generate → review → edit → approve all 4 copy modules. Deployed to Vercel production with real auth.

---

### Phase 2 — Visual Engine (Weeks 3–4)

**Sprint 5: Image Generation Infrastructure (Days 13–14)**
- `integration-specialist`: Gemini image API wrapper (`@google/genai` SDK, Nano Banana 2 model)
- `# (compositing handled natively by Gemini reference images — no Sharp needed for MVP)
- `backend-engineer`: Inngest functions for image generation (3 variants in parallel per module)
- `backend-engineer`: Supabase Storage pipeline for generated images (signed URLs, organized by package/module/variant)
- `qa-reviewer`: Image gen smoke test, storage integrity tests

**Sprint 6: Cover Generator (Days 15–16)**
- `prompt-engineer`: Cover image prompt templates per niche/brand style
- `backend-engineer`: I1 Cover module wired to fan-out
- `frontend-engineer`: Cover variant gallery in dashboard with approve/regenerate per variant

**Sprint 7: Icon + Thumbnail + Banner (Days 17–19)**
- `prompt-engineer`: Prompt templates for I2 (Icon), I3 (Start Here Thumb), I4 (Join Now Banner)
- `backend-engineer`: Modules wired
- `frontend-engineer`: Variant galleries for all visual modules

**Sprint 8: Dashboard v2 (Days 20–22)**
- `frontend-engineer`: Unified dashboard handling all 8 modules (4 copy + 4 image)
- `frontend-engineer`: "Generate all" + per-module re-runs
- `frontend-engineer`: Asset download bundle (zip of all approved images)
- `qa-reviewer`: Full end-to-end Phase 2 flow test

**Phase 2 Gate:** Full launch package generated end-to-end. All 8 modules approvable. Manual Canva handoff path working.

---

### Phase 3 — Canva Integration + Deployment Workflow (Weeks 5–6)

**Sprint 9: Canva Connect OAuth (Days 23–24)**
- `integration-specialist`: Canva Connect OAuth flow (admin-side)
- `database-architect`: `canva_template_registry` + `canva_generations` tables + RLS
- `backend-engineer`: `/api/admin/canva/*` routes
- `frontend-engineer`: Admin UI for template registration (list + add + edit)

**Sprint 10: Template Variable Mapping (Days 25–26)**
- `backend-engineer`: Variable map editor (which generator outputs map to which Canva template variables)
- `integration-specialist`: Canva Connect `/autofills` endpoint integration
- `qa-reviewer`: Template registration + variable mapping tests

**Sprint 11: One-Click Autofill (Days 27–29)**
- `backend-engineer`: `POST /api/packages/:id/canva/push` — looks up client templates, calls Canva API with approved asset payloads, stores design URLs
- `frontend-engineer`: "Push to Canva" CTA + status tracking
- `frontend-engineer`: Canva design URL display + "Open in Canva" links
- `qa-reviewer`: Canva autofill integration tests (against sandbox)

**Sprint 12: Deployment Handoff (Days 30–32)**
- `frontend-engineer`: Export page with per-field copy-to-clipboard
- `frontend-engineer`: Deployment checklist (markdown, rendered)
- `frontend-engineer`: "Mark as deployed" action → analytics event
- `qa-reviewer`: Complete deploy-ready flow test

**Phase 3 Gate:** VA runs full launch for a new client, including Canva autofill, in under 15 minutes.

---

### Phase 4 — Pattern Library Intelligence (Weeks 7–8)

**Sprint 13: Feedback Capture (Days 33–34)**
- `database-architect`: `feedback_events` table + triggers
- `backend-engineer`: Feedback event emission on every VA action (approve, edit, regenerate)
- `backend-engineer`: Quality score calculation (Supabase edge function, nightly cron)

**Sprint 14: Admin Analytics (Days 35–37)**
- `frontend-engineer`: Admin analytics dashboard (per-module quality, cost, throughput)
- `frontend-engineer`: Pattern library management UI (rank, deprecate, promote)
- `backend-engineer`: `/api/admin/patterns/promote-from-asset/:id` route

**Sprint 15: Self-Improvement Loop (Days 38–40)**
- `backend-engineer`: Weekly cron nominating top-rated assets for pattern library promotion
- `frontend-engineer`: Admin review UI for nominated patterns
- `prompt-engineer`: Pattern ranking tuning, A/B harness for prompt changes

**Sprint 16: Final QA + Handoff (Days 41–42)**
- `qa-reviewer`: Full regression suite, load testing (20 packages in-flight simultaneously)
- Mario: Documentation pass (README, deployment guide, runbook)
- Mario: Handoff session with Ramsha's team
- Mario: Production monitoring setup (Sentry alerts, PostHog dashboards)

**Phase 4 Gate:** System demonstrably improves over time. Admin analytics prove it. Handoff documentation complete.

---

## 10. Quality Gates

### Per-Sprint Definition of Done
- All tickets checked
- `qa-reviewer` approved
- No new Sentry errors in preview deploys
- Test coverage maintained (>70% on business logic)
- PR merged to `main` with passing CI
- Vercel preview demo-able

### Per-Phase Release Gate
- All sprints in phase done
- Full end-to-end test suite passing
- Demo recorded (Loom) and shared with Ramsha
- Phase retrospective: what worked, what to improve

### MVP (Phase 1 shipped) Acceptance Criteria
- [ ] VA can create a new community intake in under 5 minutes
- [ ] Generation completes for all 4 copy modules in under 60 seconds
- [ ] Each module can be approved, edited inline, or regenerated
- [ ] Copy output matches Ramsha's brand voice (subjective, Ramsha signs off)
- [ ] Zero P0/P1 bugs open

### Full Release (all 4 phases) Acceptance Criteria
- [ ] Full launch package (copy + images + Canva files) produced in under 15 VA-minutes
- [ ] At least 5 real communities launched through the system
- [ ] Quality score trending up across first 10 generations
- [ ] Meg and Samuel operate independently with zero developer support
- [ ] Admin can self-serve pattern library updates

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Claude output quality doesn't match Ramsha's bar | Medium | High | Heavy pattern library + early Ramsha review loops in Sprint 3. Prompt tuning budget in Phase 4. |
| Gemini covers look AI-generated | Medium | High | Multi-option generation so VA picks strongest. Brand template polish hides artifacts. Fallback: deliver concepts only, VA rebuilds in Canva. |
| Canva Connect API rate limits / gotchas | Medium | Medium | Phase 3 has 2-week buffer. Fallback path (manual download bundle) shipped in Phase 2. |
| Vercel function timeout breaks generation | Low (with Inngest) | High | Inngest from day one. No synchronous Claude calls in API routes. |
| Pattern library too thin for underrepresented niches | High | Medium | Niche=null universal examples always available. Admin tool to add quickly. |
| Ramsha team doesn't adopt the tool | Low | Critical | Involve Meg + Samuel in Sprint 4 dashboard review. Training session built into handoff. |
| Scope creep from Ramsha requests | High | Medium | Strict phase gates. New asks queued for post-delivery retainer work. |

---

## 12. Open Decisions

These should be closed before Sprint 1 starts.

| Decision | Owner | By |
|---|---|---|
| Intake form field list — final lock | Ramsha + Mario | Sprint 0 |
| Gemini Nano Banana 2 quality check — do we need to upgrade to Nano Banana Pro ($0.134/img) for premium clients? | Mario (test) | Sprint 5 |
| Canva Connect API access — granted? | Ramsha | Sprint 9 |
| Additional pattern library examples (5+ per module) | Ramsha | Sprint 1 |
| Hosting: Skool Skale's Vercel account or Mario-hosted? | Ramsha + Mario | Sprint 0 |
| Post-launch support model (retainer vs. ad-hoc) | Ramsha + Mario | Phase 4 handoff |
| Feature flags — use Vercel flags or build minimal? | Mario | Sprint 0 |

---

## 13. Post-Launch Operations

### Monitoring
- Sentry alert on any P0 error
- PostHog weekly digest to Mario + Ramsha
- Inngest failure alerts to Slack

### Support
- 2-week post-launch support window included
- Retainer proposal for ongoing (quote separately)

### Iteration
- Monthly Mario + Ramsha review: quality metrics, feature requests, pattern library additions
- Quarterly: major feature roadmap review

---

## 14. Appendix: File & Folder Structure

```
skoolskale-builder/
├── .claude/
│   ├── agents/
│   │   ├── database-architect.md
│   │   ├── backend-engineer.md
│   │   ├── frontend-engineer.md
│   │   ├── prompt-engineer.md
│   │   ├── integration-specialist.md
│   │   └── qa-reviewer.md
│   └── commands/                     (custom slash commands if needed)
├── CLAUDE.md                         (project-wide rules for all agents)
├── README.md
├── package.json
├── drizzle/
│   ├── schema.ts
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (authenticated)/
│   │   │   ├── dashboard/
│   │   │   ├── creators/
│   │   │   ├── packages/[id]/
│   │   │   └── admin/
│   │   ├── api/
│   │   │   ├── creators/
│   │   │   ├── packages/
│   │   │   ├── admin/
│   │   │   └── webhooks/
│   │   └── auth/
│   ├── components/
│   │   ├── ui/                       (shadcn)
│   │   ├── intake/
│   │   ├── dashboard/
│   │   └── admin/
│   ├── lib/
│   │   ├── db/                       (Drizzle client + queries)
│   │   ├── supabase/
│   │   ├── claude/                   (AI SDK wrapper)
│   │   ├── gemini-image/           (@google/genai wrapper)
│   │   ├── canva/

│   │   └── inngest/
│   │       ├── client.ts
│   │       └── functions/
│   │           ├── generate-package.ts
│   │           ├── generate-copy.ts
│   │           └── generate-images.ts
│   ├── prompts/
│   │   ├── welcome-dm.ts
│   │   ├── transformation.ts
│   │   ├── about-us.ts
│   │   ├── start-here.ts
│   │   ├── cover.ts
│   │   ├── icon.ts
│   │   ├── start-here-thumb.ts
│   │   └── join-now-banner.ts
│   └── types/
│       └── schemas.ts                (Zod schemas)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                          (Playwright)
└── .env.example
```

---

**End of PRD.**
