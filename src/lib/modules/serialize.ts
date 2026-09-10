/**
 * Serializers — a launch package's creator intake + generated_asset rows →
 * a single self-contained Markdown document (the community "DNA").
 *
 * Powers the one-click "Download .md" export. The document is both
 * human-readable and clean to feed into a downstream project, which is why
 * Markdown (not PDF) is the chosen artifact.
 *
 * Pure module — mirrors the constraints of `render.ts` and `registry.ts`:
 * no `server-only`, no DB, no runtime deps. Type-only imports from the DB
 * schema are erased at compile time, so this stays client-safe and
 * unit-testable. The per-module text builders are the single source of
 * truth for "the text a VA pastes into Skool"; `ExportView` imports the
 * Start-Here step renderers from here rather than duplicating them.
 */
import type { Creator, GeneratedAsset } from "@/lib/db/schema";
import type { CalendarEvent } from "@/types/schemas";
import { formatSchedule } from "@/lib/calendar/format-schedule";
import { renderAboutUsText, type AboutUsRenderable } from "./render";
import {
  DASHBOARD_MODULE_KEYS,
  MODULE_LABELS,
  type ModuleKey,
} from "./registry";

/* -------------------------------------------------------------------------- */
/* Content type aliases (mirror what the parsers produce — see ExportView)     */
/* -------------------------------------------------------------------------- */

type WelcomeDmContent = { content: string };
type TransformationContent = { candidates: string[] };
type StartHereContent = {
  step_1_how_to_use: {
    title: string;
    sections: { name: string; description: string }[];
  };
  step_2_community_rules: { title: string; rules: string[] };
  step_3_faqs: { question: string; answer_template: string }[];
  step_4_need_assistance: { title: string; template: string };
};
type FirstPostContent = { title: string; body: string };
type ClassroomContent = { items: { title: string; description: string }[] };
type CalendarContent = { events: CalendarEvent[] };
type LeaderboardContent = { levels: string[] };
type CategoriesContent = { categories: string[] };
type DiscoverySeoContent = { keywords: string[] };

/* -------------------------------------------------------------------------- */
/* Start Here step renderers (moved out of ExportView; imported back by it)    */
/* -------------------------------------------------------------------------- */

export function renderStep1Text(
  s: StartHereContent["step_1_how_to_use"],
): string {
  const sections = s.sections
    .map((sec) => `${sec.name}\n${sec.description}`)
    .join("\n\n");
  return `${s.title}\n\n${sections}`;
}

export function renderStep2Text(
  s: StartHereContent["step_2_community_rules"],
): string {
  const rules = s.rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return `${s.title}\n\n${rules}`;
}

export function renderStep3Text(faqs: StartHereContent["step_3_faqs"]): string {
  return faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer_template}`)
    .join("\n\n");
}

export function renderStep4Text(
  s: StartHereContent["step_4_need_assistance"],
): string {
  return `${s.title}\n\n${s.template}`;
}

function renderStartHereText(c: StartHereContent): string {
  return [
    `Step 1 — ${renderStep1Text(c.step_1_how_to_use)}`,
    `Step 2 — ${renderStep2Text(c.step_2_community_rules)}`,
    `Step 3 — FAQs\n${renderStep3Text(c.step_3_faqs)}`,
    `Step 4 — ${renderStep4Text(c.step_4_need_assistance)}`,
  ].join("\n\n");
}

/* -------------------------------------------------------------------------- */
/* Per-module text — the paste-ready body for one module                       */
/* -------------------------------------------------------------------------- */

/**
 * Full-module paste-ready text for `module`, given its raw `content` jsonb.
 * `content` is `unknown` because it's a DB jsonb column; each branch narrows
 * to the shape its generator + Zod parser guarantee (same `as` pattern
 * ExportView uses on `asset.content`).
 */
export function serializeModuleText(
  module: ModuleKey,
  content: unknown,
): string {
  switch (module) {
    case "welcome_dm":
      return (content as WelcomeDmContent).content;
    case "transformation": {
      const { candidates } = content as TransformationContent;
      return candidates
        .map((line, i) => `${i + 1}. ${line}${i === 0 ? " (selected)" : ""}`)
        .join("\n");
    }
    case "about_us":
      return renderAboutUsText(content as AboutUsRenderable);
    case "start_here":
      return renderStartHereText(content as StartHereContent);
    case "first_post": {
      const { title, body } = content as FirstPostContent;
      return `Title: ${title}\n\n${body}`;
    }
    case "classroom": {
      const { items } = content as ClassroomContent;
      return items
        .map(
          (item, i) =>
            `${i + 1}. ${item.title}\n${item.description}`,
        )
        .join("\n\n");
    }
    case "calendar": {
      const { events } = content as CalendarContent;
      return events
        .map(
          (e) => `${e.title}\n${formatSchedule(e.schedule)}\n${e.description}`,
        )
        .join("\n\n");
    }
    case "leaderboard": {
      const { levels } = content as LeaderboardContent;
      return levels.map((name, i) => `Lv ${i + 1} — ${name}`).join("\n");
    }
    case "categories": {
      const { categories } = content as CategoriesContent;
      return categories.map((name, i) => `${i + 1}. ${name}`).join("\n");
    }
    case "discovery_seo":
      return (content as DiscoverySeoContent).keywords.join(", ");
    default: {
      const _exhaustive: never = module;
      return _exhaustive;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Intake DNA — the creator inputs that produced the copy                      */
/* -------------------------------------------------------------------------- */

type OfferBreakdown = { perks?: string[]; guest_sessions?: boolean };
type PricingTier = { name: string; price: string };
type Pricing = {
  monthly?: number;
  annual?: number;
  additional_tiers?: PricingTier[];
};
type TrialTerms = { has_trial?: boolean; duration_days?: number };

function renderIntakeDna(creator: Creator): string {
  const offer = (creator.offerBreakdown ?? {}) as OfferBreakdown;
  const pricing = (creator.pricing ?? {}) as Pricing;
  const trial = (creator.trialTerms ?? null) as TrialTerms | null;

  const perks = offer.perks ?? [];
  const tiers = pricing.additional_tiers ?? [];

  const pricingLines = [
    pricing.monthly != null ? `- Monthly: $${pricing.monthly}` : null,
    pricing.annual != null ? `- Annual: $${pricing.annual}` : null,
    tiers.length > 0
      ? `- Additional tiers: ${tiers
          .map((t) => `${t.name} ${t.price}`)
          .join(", ")}`
      : null,
  ].filter((l): l is string => l !== null);

  const trialLine = trial?.has_trial
    ? `${trial.duration_days ?? 7}-day trial`
    : "No trial";

  return [
    "## Community DNA (intake)",
    "",
    `- **Creator:** ${creator.name}`,
    `- **Community:** ${creator.communityName}`,
    `- **Niche:** ${creator.niche}`,
    `- **Tone:** ${creator.tone}`,
    `- **Transformation:** ${creator.transformation}`,
    `- **Audience:** ${creator.audience}`,
    creator.supportContact
      ? `- **Support contact:** ${creator.supportContact}`
      : null,
    "",
    "**Offer**",
    `- Perks: ${perks.length > 0 ? perks.join("; ") : "—"}`,
    `- Guest sessions: ${offer.guest_sessions ? "Yes" : "No"}`,
    "",
    "**Pricing**",
    ...(pricingLines.length > 0 ? pricingLines : ["- —"]),
    "",
    `**Trial:** ${trialLine}`,
    `**Refund policy:** ${creator.refundPolicy || "—"}`,
    `**Brand preferences:** ${creator.brandPrefs || "—"}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* Whole-package document                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Serialize a launch package to one Markdown document: a title, the intake
 * DNA block, then one `## {label}` section per generated module that has an
 * asset (registry order). Modules with no asset are skipped silently.
 *
 * Deterministic — no timestamps — so it's testable and diff-stable.
 */
export function serializePackageMarkdown(
  creator: Creator,
  assets: GeneratedAsset[],
): string {
  const byModule = new Map<string, GeneratedAsset>(
    assets.map((a) => [a.module, a]),
  );

  const sections = DASHBOARD_MODULE_KEYS.flatMap((key) => {
    const asset = byModule.get(key);
    if (!asset) return [];
    return [`## ${MODULE_LABELS[key]}\n\n${serializeModuleText(key, asset.content)}`];
  });

  // Blocks joined with a blank line so every `##` section is preceded by one —
  // cleaner to read and safe for strict Markdown parsers. Trailing newline so
  // the file ends with one.
  return (
    [
      `# ${creator.communityName} — Launch Package DNA`,
      `_${creator.name} · ${creator.niche} · ${creator.tone} tone_`,
      renderIntakeDna(creator),
      ...sections,
    ].join("\n\n") + "\n"
  );
}

/* -------------------------------------------------------------------------- */
/* Download filename                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Attachment filename for a package's Markdown export, slugged from the
 * community name: lowercased, every run of non-alphanumerics (spaces,
 * punctuation, emoji) collapsed to a single hyphen, ends trimmed. Falls back
 * to "community" when the name has no alphanumerics.
 */
export function packageMarkdownFilename(creator: Creator): string {
  const slug =
    creator.communityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "community";
  return `${slug}-launch-package.md`;
}
