/**
 * Handover brief — the compact facts block shared by every deliverable call.
 *
 * TypeScript port of scaffold_handover.py's build_brief + cli/prompts.py's
 * format_brief, reading the builder's STRUCTURED rows (Creator jsonb columns
 * + latest generated_asset content) instead of re-parsing the markdown DNA.
 * The raw DNA markdown still rides along as its own system block (see
 * system-blocks.ts); the brief is the normalized summary on top of it.
 *
 * One heuristic survives the port: the entry tier has no name in
 * `creator.pricing`, so we guess it from the About-Us asset's rendered
 * pricing line (same regex as the Python), falling back to "Standard".
 *
 * Pure module — type-only DB imports, no `server-only`.
 */
import type { Creator, GeneratedAsset } from "@/lib/db/schema";
import type { CalendarEvent } from "@/types/schemas";
import { formatSchedule } from "@/lib/calendar/format-schedule";

export type HandoverTier = {
  name: string;
  monthly: string | null;
  annual: string | null;
};

export type HandoverBrief = {
  creator: string;
  creatorFirst: string;
  community: string;
  slug: string;
  niche: string;
  tone: string;
  transformation: string;
  transformationLine: string | null;
  audience: string;
  supportEmail: string | null;
  guestSessions: boolean;
  perks: string | null;
  trial: string;
  refund: string | null;
  brandPrefs: string | null;
  pricing: {
    tiers: HandoverTier[];
    hasAnnual: boolean;
    /** Skool default: a free entry tier exists unless the DNA says paid-only. */
    freeTier: boolean;
  };
  modules: string[];
  calls: { name: string; when: string | null; blurb: string | null }[];
  levels: string[];
  categories: string[];
};

/* ----------------------------- asset lookup ------------------------------ */

type TransformationContent = { candidates: string[] };
type AboutUsContent = { pricing: string };
type ClassroomContent = { items: { title: string }[] };
type CalendarContent = { events: CalendarEvent[] };
type LeaderboardContent = { levels: string[] };
type CategoriesContent = { categories: string[] };

function assetContent<T>(assets: GeneratedAsset[], module: string): T | null {
  const asset = assets.find((a) => a.module === module);
  return asset ? (asset.content as T) : null;
}

/* ----------------------------- tier parsing ------------------------------ */

const KNOWN_ACRONYMS = new Set(["vip", "vvip", "pro", "ai", "diy", "dfy"]);

function fixCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) =>
      KNOWN_ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/**
 * Entry-tier naming varies per client (Standard, Premium, Member...), so we
 * read the name actually paired with a price in the About-Us pricing line,
 * fall back to a keyword guess, then "Standard".
 */
export function guessEntryTierName(aboutUsPricingText: string): string {
  const priced = aboutUsPricingText.match(/\b([A-Z][A-Za-z']*)\b\s*[:(]\s*\$?\d/);
  if (priced) return fixCase(priced[1]);
  const keyword = aboutUsPricingText.match(
    /\b(Standard|Basic|Core|Starter|Member(?:ship)?|Premium)\b/i,
  );
  return keyword ? fixCase(keyword[1]) : "Standard";
}

/**
 * Parse an additional-tier price string ("57m or 477", "$57/mo or $477/yr")
 * into normalized monthly/annual strings. Port of _split_extra_tiers' number
 * extraction — the tier NAME arrives typed from the intake schema, so only
 * the price needs parsing here.
 */
export function parseTierPrice(price: string): {
  monthly: string | null;
  annual: string | null;
} {
  let monthly =
    price.match(/\$?\s*(\d+)\s*(?:\/?\s*mo?\b)/i)?.[1] ?? null;
  let annual =
    price.match(/\$?\s*(\d+)\s*(?:\/?\s*(?:yr|year)\b)/i)?.[1] ?? null;
  const bare = [...price.matchAll(/\$?\s*(\d+)/g)].map((m) => m[1]);
  if (monthly && !annual) {
    const rest = bare.filter((n) => n !== monthly);
    if (rest.length > 0) annual = rest[rest.length - 1];
  } else if (annual && !monthly) {
    const rest = bare.filter((n) => n !== annual);
    if (rest.length > 0) monthly = rest[0];
  } else if (!monthly && !annual) {
    if (bare.length >= 2) [monthly, annual] = [bare[0], bare[1]];
    else if (bare.length === 1) monthly = bare[0];
  }
  return {
    monthly: monthly ? `$${monthly}/mo` : null,
    annual: annual ? `$${annual}/yr` : null,
  };
}

/* ------------------------------ build brief ------------------------------ */

type OfferBreakdown = { perks?: string[]; guest_sessions?: boolean };
type Pricing = {
  monthly?: number;
  annual?: number;
  additional_tiers?: { name: string; price: string }[];
};
type TrialTerms = { has_trial?: boolean; duration_days?: number };

export function buildHandoverBrief(
  creator: Creator,
  assets: GeneratedAsset[],
): HandoverBrief {
  const offer = (creator.offerBreakdown ?? {}) as OfferBreakdown;
  const pricing = (creator.pricing ?? {}) as Pricing;
  const trial = (creator.trialTerms ?? null) as TrialTerms | null;

  const aboutUs = assetContent<AboutUsContent>(assets, "about_us");
  const transformation = assetContent<TransformationContent>(
    assets,
    "transformation",
  );
  const classroom = assetContent<ClassroomContent>(assets, "classroom");
  const calendar = assetContent<CalendarContent>(assets, "calendar");
  const leaderboard = assetContent<LeaderboardContent>(assets, "leaderboard");
  const categories = assetContent<CategoriesContent>(assets, "categories");

  const tiers: HandoverTier[] = [];
  if (pricing.monthly != null || pricing.annual != null) {
    tiers.push({
      name: guessEntryTierName(aboutUs?.pricing ?? ""),
      monthly: pricing.monthly != null ? `$${pricing.monthly}/mo` : null,
      annual: pricing.annual != null ? `$${pricing.annual}/yr` : null,
    });
  }
  for (const t of pricing.additional_tiers ?? []) {
    tiers.push({ name: fixCase(t.name), ...parseTierPrice(t.price) });
  }

  const perks = offer.perks ?? [];
  const slug =
    creator.communityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "community";

  return {
    creator: creator.name,
    creatorFirst: creator.name.split(/\s+/)[0] ?? creator.name,
    community: creator.communityName,
    slug,
    niche: creator.niche,
    tone: creator.tone,
    transformation: creator.transformation,
    transformationLine: transformation?.candidates[0] ?? null,
    audience: creator.audience,
    supportEmail: creator.supportContact || null,
    guestSessions: offer.guest_sessions === true,
    perks: perks.length > 0 ? perks.join("; ") : null,
    trial: trial?.has_trial ? `${trial.duration_days ?? 7}-day trial` : "No trial",
    refund: creator.refundPolicy || null,
    brandPrefs: creator.brandPrefs || null,
    pricing: {
      tiers,
      hasAnnual: tiers.some((t) => t.annual !== null),
      freeTier: true,
    },
    modules: classroom?.items.map((i) => i.title) ?? [],
    calls:
      calendar?.events.map((e) => ({
        name: e.title,
        when: formatSchedule(e.schedule),
        blurb: e.description || null,
      })) ?? [],
    levels: leaderboard?.levels ?? [],
    categories: categories?.categories ?? [],
  };
}

/* ------------------------------ format brief ----------------------------- */

function tierPriceLabel(t: HandoverTier): string {
  const parts = [t.monthly, t.annual].filter((x): x is string => x !== null);
  return parts.join(" or ");
}

function tierLine(pricing: HandoverBrief["pricing"]): string {
  const parts: string[] = [];
  if (pricing.freeTier) parts.push("Free");
  for (const t of pricing.tiers) {
    const price = tierPriceLabel(t);
    parts.push(price ? `${t.name} (${price})` : t.name);
  }
  return parts.length > 0 ? parts.join(" · ") : "not specified in DNA";
}

/** Public for the README builder's offer summary line. */
export function formatTierSummary(pricing: HandoverBrief["pricing"]): string {
  return tierLine(pricing);
}

/**
 * Render the brief into the compact facts block for the system prompt.
 * Port of cli/prompts.py format_brief — same lines, same order, so the
 * proven prompt behavior carries over.
 */
export function formatBrief(brief: HandoverBrief): string {
  const calls =
    brief.calls
      .map((c) => `"${c.name}"` + (c.when ? ` (${c.when})` : ""))
      .join(" · ") || "none listed";
  return `COMMUNITY DNA BRIEF — use ONLY these facts; never invent others.
- Community: ${brief.community}
- Creator: ${brief.creator} (sign as "${brief.creatorFirst}")
- Niche: ${brief.niche} · Tone: ${brief.tone} (match the DNA's own writing rhythm)
- Transformation: ${brief.transformation}
- Selected transformation line: ${brief.transformationLine ?? "not specified"}
- Audience: ${brief.audience}
- Support contact: ${brief.supportEmail ?? "not specified"}
- Guest sessions: ${brief.guestSessions ? "YES" : "NO"}
- Trial: ${brief.trial} · Refund: ${brief.refund ?? "not specified"}
- Pricing tiers (use these names + prices consistently everywhere): ${tierLine(brief.pricing)}
- Annual pricing exists: ${brief.pricing.hasAnnual ? "YES — founding-member urgency ON, lead annual" : "no"}
- Classroom modules: ${brief.modules.length > 0 ? brief.modules.join(" · ") : "none listed"}
- Live calls (Calendar): ${calls}
- Leaderboard levels: ${brief.levels.length > 0 ? brief.levels.join(" → ") : "none listed"}
- Post categories: ${brief.categories.length > 0 ? brief.categories.join(" · ") : "none listed"}`;
}
