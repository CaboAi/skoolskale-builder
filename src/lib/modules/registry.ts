/**
 * Module registry — single source of truth for all module-level metadata.
 *
 * Adding or removing a module is a registry edit plus three obligations:
 *   1. Add a Zod schema in `src/prompts/<module>.ts` (or import existing).
 *   2. Add an Inngest sub-function in `src/lib/inngest/functions/`.
 *   3. Wire the sub-function into the orchestrator's local FUNCTIONS map.
 *
 * Everything else — API enum validation, dashboard card dispatch, export
 * page guard, edit-form labels — reads from this file.
 *
 * Constraints:
 * - Pure module. No `server-only` imports, no Inngest imports, no DB imports.
 *   This file is bundled into the client because `module-cards.tsx` and
 *   `ExportView.tsx` import it.
 *
 * Image modules removed: the builder is copy-only as of the
 * `chore/remove-image-generation` cut. VAs handle community visuals
 * (cover, icon, classroom cover, calendar cover) externally in Canva
 * using the client's professional photography. Old packages may still
 * carry `module='cover'` rows in generated_assets — those are intentionally
 * orphaned (the registry no longer surfaces them in the dashboard or
 * export view). DB and Supabase Storage are untouched.
 */
import type { ZodSchema } from "zod";
import { WelcomeDmSchema } from "@/prompts/welcome-dm";
import { TransformationSchema } from "@/prompts/transformation";
import { AboutUsSchema } from "@/prompts/about-us";
import { StartHereSchema } from "@/prompts/start-here";
import {
  ClassroomContentSchema,
  CalendarContentSchema,
  LeaderboardContentSchema,
  CategoriesContentSchema,
  DiscoverySeoContentSchema,
} from "@/types/schemas";

export type ModuleKey =
  | "welcome_dm"
  | "transformation"
  | "about_us"
  | "start_here"
  // Add-on text modules — registered in PR #4 (intake), generators in PR #6.
  | "classroom"
  | "calendar"
  | "leaderboard"
  | "categories"
  | "discovery_seo";

export type GeneratorKind = "claude-text" | "passthrough";

/**
 * Renderer-component lookup key. Every CardVariant must have a CARD_COMPONENTS
 * entry — the dispatcher in PackageDashboard is `Record<>`, not
 * `Partial<Record<>>`. Adding a new variant without a component is a
 * compile-time error.
 *
 *   simple-text     -> TextModuleCard (welcome_dm + transformation + classroom + calendar)
 *   about-us        -> AboutUsCard
 *   start-here      -> StartHereCard
 *   leaderboard     -> LeaderboardCard
 *   repeater        -> CategoriesCard
 *   chips           -> DiscoverySeoCard
 */
export type CardVariant =
  | "simple-text"
  | "about-us"
  | "start-here"
  | "leaderboard"
  | "repeater"
  | "chips";

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  outputSchema: ZodSchema;
  generatorKind: GeneratorKind;
  cardVariant: CardVariant;
  includedByDefault: boolean;
  /** Inngest event name; matches the sub-function's trigger. */
  eventName: `generate.${string}.requested`;
  /**
   * Soft length aim threaded into the prompt. Optional — only set for
   * modules where Skool enforces a hard character cap and the prompt
   * needs an explicit budget. Counted against the rendered text that
   * the VA pastes into Skool, not the JSON envelope.
   */
  targetChars?: number;
  /**
   * Hard length cap enforced by the parser + Zod schema. Outputs above
   * this length throw CapViolationError, trigger one automatic retry
   * with a "rewrite tighter" follow-up, then fail the job if the retry
   * is also over. Skool truncates or rejects pastes above this length.
   */
  maxChars?: number;
}

export const MODULE_REGISTRY: Record<ModuleKey, ModuleConfig> = {
  welcome_dm: {
    key: "welcome_dm",
    label: "Welcome DM",
    outputSchema: WelcomeDmSchema,
    generatorKind: "claude-text",
    cardVariant: "simple-text",
    includedByDefault: true,
    eventName: "generate.welcome_dm.requested",
    // #NAME# (6 chars) and #GROUPNAME# (11 chars) expand at Skool send time.
    // Worst-case net expansion is ~25 chars (e.g. 'Christopher' + 'The Calm
    // Closer Locker Room'). We generate under 275 to guarantee the rendered
    // DM stays under Skool's 300-char cap.
    targetChars: 250,
    maxChars: 275,
  },
  transformation: {
    key: "transformation",
    label: "Transformation Line",
    outputSchema: TransformationSchema,
    generatorKind: "claude-text",
    cardVariant: "simple-text",
    includedByDefault: true,
    eventName: "generate.transformation.requested",
  },
  about_us: {
    key: "about_us",
    label: "About Us",
    outputSchema: AboutUsSchema,
    generatorKind: "claude-text",
    cardVariant: "about-us",
    includedByDefault: true,
    eventName: "generate.about_us.requested",
    // Skool's About Us field truncates around 1,050 chars. Two real deployed
    // examples landed at 971 and 1,028 chars. Generate to 900 to leave slack.
    targetChars: 900,
    maxChars: 1050,
  },
  start_here: {
    key: "start_here",
    label: "Start Here",
    outputSchema: StartHereSchema,
    generatorKind: "claude-text",
    cardVariant: "start-here",
    includedByDefault: true,
    eventName: "generate.start_here.requested",
  },
  classroom: {
    key: "classroom",
    label: "Classroom",
    outputSchema: ClassroomContentSchema,
    generatorKind: "claude-text",
    cardVariant: "simple-text",
    includedByDefault: true,
    eventName: "generate.classroom.requested",
  },
  calendar: {
    key: "calendar",
    label: "Calendar",
    outputSchema: CalendarContentSchema,
    generatorKind: "claude-text",
    cardVariant: "simple-text",
    includedByDefault: true,
    eventName: "generate.calendar.requested",
  },
  leaderboard: {
    key: "leaderboard",
    label: "Leaderboard Levels",
    outputSchema: LeaderboardContentSchema,
    generatorKind: "claude-text",
    cardVariant: "leaderboard",
    includedByDefault: true,
    eventName: "generate.leaderboard.requested",
  },
  categories: {
    key: "categories",
    label: "Categories",
    outputSchema: CategoriesContentSchema,
    generatorKind: "claude-text",
    cardVariant: "repeater",
    includedByDefault: true,
    eventName: "generate.categories.requested",
  },
  discovery_seo: {
    key: "discovery_seo",
    label: "Discovery SEO",
    outputSchema: DiscoverySeoContentSchema,
    generatorKind: "claude-text",
    cardVariant: "chips",
    includedByDefault: true,
    eventName: "generate.discovery_seo.requested",
  },
};

/** Tuple form for `z.enum(...)`, narrowed so callers don't need to cast. */
export const MODULE_KEYS = Object.keys(MODULE_REGISTRY) as [
  ModuleKey,
  ...ModuleKey[],
];

/**
 * Loose `Record<string, string>` type for back-compat with callers that
 * index by `asset.module` (typed as `string` in the DB row). Values are
 * still keyed by `ModuleKey` at the data level.
 */
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(MODULE_REGISTRY).map((m) => [m.key, m.label]),
);

/**
 * Order in which modules render on the package dashboard. All registered
 * modules are now default-on (image modules removed).
 */
export const DASHBOARD_MODULE_KEYS = MODULE_KEYS.filter(
  (k) => MODULE_REGISTRY[k].includedByDefault,
) as ModuleKey[];
