/**
 * Which generated modules an intake edit invalidates.
 *
 * Editing a creator does not rewrite copy that was already generated from
 * it. Rename a community and the stored About Us, Start Here and First Post
 * still carry the old name until someone regenerates them, which is exactly
 * how a half-renamed package ships. This maps each intake field to the
 * modules whose prompts consume it so the edit screen can say which cards
 * went stale instead of leaving the VA to guess.
 *
 * Deliberately not part of MODULE_REGISTRY: the registry describes what a
 * module IS, and this describes an editing side effect. It is also allowed
 * to over-report. A field listed against a module the generator only
 * loosely uses costs one unnecessary regeneration; a field missing from a
 * module it really feeds ships the client stale copy.
 *
 * Pure module.
 */
import type { CreatorIntake } from "@/types/schemas";
import type { ModuleKey } from "@/lib/modules/registry";

export type IntakeField = keyof CreatorIntake;

/**
 * Fields every text generator sees through the shared brief, so a change
 * to one of them makes the whole package stale.
 */
const ALL_TEXT_MODULES: ModuleKey[] = [
  "welcome_dm",
  "transformation",
  "about_us",
  "start_here",
  "first_post",
  "classroom",
  "calendar",
  "leaderboard",
  "categories",
  "discovery_seo",
];

export const FIELD_IMPACTS: Record<IntakeField, ModuleKey[]> = {
  // Voice and identity reach every prompt.
  community_name: ALL_TEXT_MODULES,
  tone: ALL_TEXT_MODULES,
  transformation: ALL_TEXT_MODULES,
  audience: ALL_TEXT_MODULES,
  niche: ALL_TEXT_MODULES,
  brand_prefs: ALL_TEXT_MODULES,

  // The creator's own name is signed into the copy that speaks as them.
  name: ["welcome_dm", "about_us", "start_here", "first_post"],

  // Offer and commercial terms surface on the sales-facing modules.
  offer_breakdown: ["about_us", "start_here", "first_post"],
  pricing: ["about_us", "start_here"],
  trial_terms: ["about_us", "start_here"],
  refund_policy: ["about_us", "start_here"],
  support_contact: ["start_here"],

  // Add-on intake feeds its own module, and the tour copy that lists them.
  classroom_titles: ["classroom", "start_here"],
  calendar_intake: ["calendar", "start_here"],
  leaderboard_levels: ["leaderboard"],
  categories: ["categories", "first_post"],
  discovery_keywords: ["discovery_seo"],
};

/**
 * Modules invalidated by a set of changed fields, in registry order so the
 * warning reads in the same order as the dashboard cards.
 */
export function staleModulesFor(changed: IntakeField[]): ModuleKey[] {
  const affected = new Set<ModuleKey>();
  for (const field of changed) {
    for (const key of FIELD_IMPACTS[field] ?? []) affected.add(key);
  }
  return ALL_TEXT_MODULES.filter((key) => affected.has(key));
}

/** Intake fields whose value differs between two form snapshots. */
export function changedFields(
  before: CreatorIntake,
  after: CreatorIntake,
): IntakeField[] {
  const keys = Object.keys(after) as IntakeField[];
  return keys.filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}
