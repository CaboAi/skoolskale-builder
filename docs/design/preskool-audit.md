# preSkool Redesign — Audit & Proposed Tokens (DRAFT)

> Status: pending sign-off. No component code has been touched. Once Mario approves the palette, typography, and radius proposals below, the next commits start applying them.

## What was scanned

- Stack: Next 16 (App Router), React 19, Tailwind v4 (CSS-first via `@theme` in `src/app/globals.css`), shadcn 4.4.0, `next-themes` 0.4.6 already installed, `@base-ui/react` button primitive, `lucide-react` icons.
- Fonts in use: `Geist` + `Geist_Mono` via `next/font/google`, both wired to CSS vars.
- Theme today: pure-grayscale OKLCH only (every color has `chroma = 0`). No accent. No semantic palette beyond `--destructive`. Background is pure white `oklch(1 0 0)`.
- Radius today: `--radius: 0.625rem` (10px) with a sm→4xl multiplier scale already defined.
- Branding strings in UI: `SkoolSkale Community Builder` (home header), `you@skoolskale.com` (login placeholder). Backend strings (`src/prompts/welcome-dm.ts`, `src/lib/inngest/client.ts`) are out of scope per brief.
- Dark mode infra: `@custom-variant dark (&:is(.dark *))` already defined and `.dark { … }` block already populated with grayscale dark vars — but no provider, no toggle, no html-class wiring. `next-themes` is installed and unused.
- Tests scanned for color/class assertions that retokening would break: **none found**. Tests assert on DOM shape and text, not on Tailwind class strings or hex values. Retokening is safe.

## Top audit findings (the things that actually matter for this PR)

1. **Zero brand identity.** The UI is shadcn-default neutral grayscale. There is literally no accent color anywhere. This is the single highest-impact fix and is the whole reason for the PR.
2. **No display typography contrast.** `--font-heading` is already wired as a token but aliased to `--font-sans` (`Geist`). Headings and body share a face.
3. **Status colors hardcoded to Tailwind colors, not semantic tokens.** `STATUS_STYLES` in `PackageDashboard.tsx` uses `bg-blue-500/15`, `bg-amber-500/15`, `bg-emerald-500/15` directly. `ApprovalCheck` in `module-cards.tsx` uses `fill-emerald-500`. `PromptExpander` uses `border-amber-500/60`. These should move to semantic tokens (`info`, `warning`, `success`) so dark mode and palette changes don't drift.
4. **Pure white background.** Per the redesign skill, replace with a barely-tinted off-white in light mode and a tinted off-black in dark mode — pure `#fff` / `#000` read as defaults.
5. **No shared app chrome.** Each route renders its own inline header. No `<AppHeader />`. The wordmark + theme toggle live nowhere right now — this PR introduces the shared header that hosts both.
6. **Dark mode is half-wired.** The CSS variables exist, but nothing flips `.dark` on `<html>`. `next-themes` is installed, costs nothing to wire.

Lower-priority audit items intentionally **out of scope** for this PR (call out so we don't forget): no shared footer, no skip-to-content link, no custom 404, no loading skeleton variations beyond what shadcn ships, no motion system. Those belong in a follow-up polish PR.

## Proposed identity — "Schoolyard"

Warm teal as the primary, coral as the playful accent, warm-tinted neutrals. Reads competent-but-warm, doesn't collide with the obvious community/learning brands (Skool's cobalt-blue, Duolingo green, Khan-Academy green, Outschool aqua, Mighty Networks purple). Distinct enough to anchor the wordmark.

### Palette (OKLCH)

Light mode:

| Token | Value | Notes |
|---|---|---|
| `--background` | `oklch(0.99 0.005 80)` | Barely-tinted warm cream-white. Not `#fff`. |
| `--foreground` | `oklch(0.20 0.02 250)` | Ink with faint blue undertone. |
| `--card` | `oklch(1 0 0)` | Cards lift one step above the cream background. |
| `--card-foreground` | `oklch(0.20 0.02 250)` | |
| `--popover` | `oklch(1 0 0)` | |
| `--popover-foreground` | `oklch(0.20 0.02 250)` | |
| `--primary` | `oklch(0.55 0.11 200)` | Warm teal. Confident, not corporate. |
| `--primary-foreground` | `oklch(0.99 0 0)` | |
| `--secondary` | `oklch(0.96 0.01 80)` | Warm-tinted gray. |
| `--secondary-foreground` | `oklch(0.20 0.02 250)` | |
| `--accent` | `oklch(0.72 0.16 25)` | Coral. The playful highlight. |
| `--accent-foreground` | `oklch(0.18 0.02 25)` | Deep warm brown for type on accent. |
| `--muted` | `oklch(0.96 0.01 80)` | |
| `--muted-foreground` | `oklch(0.50 0.02 250)` | |
| `--border` | `oklch(0.91 0.01 80)` | Warm-tinted, lower contrast than today's `0.922`. |
| `--input` | `oklch(0.91 0.01 80)` | |
| `--ring` | `oklch(0.65 0.10 200)` | Teal at 65% L — visible focus ring. |
| `--destructive` | `oklch(0.58 0.22 27)` | Slightly desaturated from current to fit the family. |
| `--success` | `oklch(0.62 0.13 155)` | NEW. Teal-leaning green. Replaces hardcoded `emerald-500`. |
| `--warning` | `oklch(0.74 0.14 75)` | NEW. Amber-orange. Replaces hardcoded `amber-500`. |
| `--info` | `oklch(0.58 0.13 230)` | NEW. Desaturated blue. Replaces hardcoded `blue-500`. |
| `--chart-1` | `oklch(0.55 0.11 200)` | Primary teal. |
| `--chart-2` | `oklch(0.72 0.16 25)` | Coral accent. |
| `--chart-3` | `oklch(0.74 0.14 75)` | Warning amber. |
| `--chart-4` | `oklch(0.62 0.13 155)` | Success green. |
| `--chart-5` | `oklch(0.58 0.13 230)` | Info blue. |

Dark mode:

| Token | Value | Notes |
|---|---|---|
| `--background` | `oklch(0.16 0.01 250)` | Tinted off-black, not pure `#000`. |
| `--foreground` | `oklch(0.96 0 0)` | |
| `--card` | `oklch(0.20 0.01 250)` | One step lighter than background. |
| `--card-foreground` | `oklch(0.96 0 0)` | |
| `--popover` | `oklch(0.20 0.01 250)` | |
| `--popover-foreground` | `oklch(0.96 0 0)` | |
| `--primary` | `oklch(0.72 0.12 200)` | Teal brightens for dark surface contrast. |
| `--primary-foreground` | `oklch(0.16 0.01 250)` | |
| `--secondary` | `oklch(0.25 0.01 250)` | |
| `--secondary-foreground` | `oklch(0.96 0 0)` | |
| `--accent` | `oklch(0.75 0.15 25)` | Coral brightens slightly. |
| `--accent-foreground` | `oklch(0.16 0.01 250)` | |
| `--muted` | `oklch(0.25 0.01 250)` | |
| `--muted-foreground` | `oklch(0.68 0.01 250)` | |
| `--border` | `oklch(1 0 0 / 12%)` | |
| `--input` | `oklch(1 0 0 / 15%)` | |
| `--ring` | `oklch(0.65 0.10 200)` | Same ring across modes. |
| `--destructive` | `oklch(0.70 0.19 22)` | Close to current dark value. |
| `--success` | `oklch(0.72 0.13 155)` | |
| `--warning` | `oklch(0.80 0.14 75)` | |
| `--info` | `oklch(0.70 0.14 230)` | |

Sidebar tokens follow the same retoken pattern (primary teal, accent coral).

### Alternative palettes (if Schoolyard is rejected)

- **Sunbeam** — warm coral primary `oklch(0.65 0.18 30)`, marigold accent `oklch(0.78 0.15 75)`, navy neutrals. More optimistic, slightly Mailchimp-adjacent.
- **Notebook** — deep aubergine primary `oklch(0.40 0.12 320)`, marigold accent, warm-gray neutrals. Editorial, riskier as "playful."

## Typography

| Role | Font | Source | Weights | Rationale |
|---|---|---|---|---|
| Heading | **Outfit** | Google Fonts (variable) | 500, 600, 700, 800 | Rounded geometric sans. Reads playful at display sizes without being childish. Free variable font — no perf cost. |
| Body | **Geist Sans** | Already in repo | 400, 500, 600 | Strong neutral body face. No reason to swap. |
| Mono | **Geist Mono** | Already in repo | 400, 500 | Already in use in `PromptExpander`. Keep. |

`--font-heading` is wired as a token but pointing at `--font-sans` today. The fix is to load `Outfit` via `next/font/google` in `app/layout.tsx` alongside the existing Geist fonts, expose it as `--font-outfit`, and point `--font-heading` at it. Card title and heading components already use `font-heading` — they pick it up automatically.

Suggested heading scale tweaks (no Tailwind config change required — applied via classes on the headings themselves):

- `h1` page titles: `text-3xl sm:text-4xl font-bold tracking-tight font-heading`
- `h2` section titles: `text-xl font-semibold tracking-tight font-heading`
- Card titles: existing `font-heading text-base font-medium` (already set) — leave alone

Heading weight bumps from `font-medium`→`font-semibold` give Outfit room to feel intentional without being shouty.

## Radius

Bump `--radius` from `0.625rem` (10px) to `0.875rem` (14px). The existing scale formulas in `globals.css` cascade everything proportionally:

- `--radius-sm`: 6px → 8.4px
- `--radius-md`: 8px → 11.2px
- `--radius-lg`: 10px → 14px (the base)
- `--radius-xl`: 14px → 19.6px
- `--radius-2xl`: 18px → 25.2px

Card uses `rounded-xl` (≈ 14→20px), buttons use `rounded-lg` (≈ 10→14px), input/select/textarea use `rounded-md` (≈ 8→11px). Result: meaningfully rounder corners across the board, no per-component edits.

## Dark mode wiring

1. Wrap children in `<ThemeProvider>` from `next-themes` inside `app/layout.tsx` with:
   - `attribute="class"` (matches the existing `.dark` strategy)
   - `defaultTheme="system"`
   - `enableSystem`
   - `disableTransitionOnChange` (prevents flash when toggling)
2. Add `suppressHydrationWarning` on `<html>` (required by `next-themes`).
3. New component `src/components/branding/ThemeToggle.tsx` — sun/moon icon button using `lucide-react`'s `Sun` + `Moon`. Uses `useTheme()`. Three-state cycle (light → dark → system) with `aria-label` reflecting current state.
4. New component `src/components/branding/AppHeader.tsx` — shared chrome holding `<PreSkoolWordmark />` (left) and `<ThemeToggle />` (right). Used on home, package dashboard, export view, login.

## Wordmark

`src/components/branding/PreSkoolWordmark.tsx` — text-based SVG, original letterforms (not a Skool ripoff). Letters cycle through 3 brand colors so the wordmark *is* the logo:

```
p   r   e   S   k   o   o   l
T   C   W   T   S   C   W   T
```

T = teal (primary), C = coral (accent), W = warning amber, S = success green. The capital `S` anchors the wordwise pun on "Skool"; the `S` is sized ~115% of the other letters for emphasis.

Two variants:
- `<PreSkoolWordmark />` — full "preSkool"
- `<PreSkoolWordmark compact />` — "pS" for narrow contexts (mobile nav, favicon stand-in)

Works on light AND dark backgrounds because the brand colors keep ≥ 4.5:1 contrast against both `--background` values (verified mentally; will measure in implementation). The wordmark `fill`s use the same CSS vars as the rest of the system, so palette changes propagate.

## Behavior preservation guarantees

- No new dependencies (Outfit is a Google Font loaded via `next/font`; `next-themes` already installed).
- No component shape changes. Restyling is **CSS-variable-driven** wherever possible.
- The three places that hardcode Tailwind color literals (`STATUS_STYLES`, `ApprovalCheck`, `PromptExpander` edited-border) get tiny edits to point at semantic tokens (`--success`, `--warning`, `--info`) — same visual intent, palette-aware now.
- Route structure, behavior, mutations, tests — untouched.
- Metadata title `"Create Next App"` (left over from scaffolding) gets fixed to `"preSkool"` at the same time as the header rebrand. Backend strings stay as `Skool Skale` / `skoolskale` per brief.

## Decisions needed from Mario before I start coding

1. **Palette: Schoolyard (teal + coral) vs Sunbeam vs Notebook** — or "adjust Schoolyard, here's what I want different"?
2. **Heading font: Outfit** — or do you want me to mock with Fraunces (variable serif) as a B option?
3. **Radius bump to 14px** — or stay at 10px?
4. **Wordmark color cycle** — teal/coral/amber/green on `preSkool`, or do you want a different letter→color assignment?
5. **Anything to add/remove from the in-scope vs out-of-scope split above?**

Once you sign off (even partially — e.g., "approve palette + radius, swap heading to Fraunces"), I'll proceed with the commit plan from the brief: (1) tokens + Tailwind config, (2) dark mode infra + toggle, (3) component restyling, (4) wordmark + header rebrand.
