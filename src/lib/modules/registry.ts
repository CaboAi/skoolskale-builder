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
 */
import type { ZodSchema } from "zod";
import { WelcomeDmSchema } from "@/prompts/welcome-dm";
import { TransformationSchema } from "@/prompts/transformation";
import { AboutUsSchema } from "@/prompts/about-us";
import { StartHereSchema } from "@/prompts/start-here";
import { CoverContentSchema } from "@/prompts/cover";
import { IconContentSchema } from "@/prompts/icon";
import { ClassroomCoverContentSchema } from "@/prompts/classroom_cover";
import { CalendarCoverContentSchema } from "@/prompts/calendar_cover";
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
  | "cover"
  // Add-on text modules — registered in PR #4 (intake), generators in PR #6.
  | "classroom"
  | "calendar"
  | "leaderboard"
  | "categories"
  | "discovery_seo"
  // Image companions for the add-on text modules — generators in PR #7.
  | "icon"
  | "classroom_cover"
  | "calendar_cover";

export type GeneratorKind = "claude-text" | "gemini-image" | "passthrough";

/**
 * Renderer-component lookup key. Every CardVariant must have a CARD_COMPONENTS
 * entry — the dispatcher in PackageDashboard is now `Record<>`, not
 * `Partial<Record<>>`. Adding a new variant without a component is a
 * compile-time error.
 *
 *   simple-text     -> TextModuleCard (welcome_dm + transformation)
 *   about-us        -> AboutUsCard
 *   start-here      -> StartHereCard
 *   image-variants  -> ImageVariantsCard (cover + icon)
 *   image-single    -> ImageModuleCard (classroom_cover + calendar_cover)
 *   leaderboard     -> LeaderboardCard
 *   repeater        -> CategoriesCard
 *   chips           -> DiscoverySeoCard
 */
export type CardVariant =
  | "simple-text"
  | "about-us"
  | "start-here"
  | "image-variants"
  | "image-single"
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
  /** UI hint: render the card across both columns of the 2-col grid. */
  fullWidth?: boolean;
  /** UI hint: hide the Edit button (cover only — variant selection is the edit). */
  showEdit?: boolean;
  /**
   * Image modules with multiple variants. PR #6 sets this only for cover;
   * PR #7 will set it for icon and use it to drive a generic
   * /modules/[module]/select-variant API route.
   */
  hasVariants?: boolean;
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
  cover: {
    key: "cover",
    label: "Community Cover",
    outputSchema: CoverContentSchema,
    generatorKind: "gemini-image",
    cardVariant: "image-variants",
    includedByDefault: true,
    eventName: "generate.cover.requested",
    fullWidth: true,
    showEdit: false,
    hasVariants: true,
  },
  // Add-on text modules — generators wired in PR #6.
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
  // Image companions — generators wired in PR #7.
  icon: {
    key: "icon",
    label: "Community Icon",
    outputSchema: IconContentSchema,
    generatorKind: "gemini-image",
    cardVariant: "image-variants",
    includedByDefault: true,
    eventName: "generate.icon.requested",
    showEdit: false,
    hasVariants: true,
  },
  classroom_cover: {
    key: "classroom_cover",
    label: "Classroom Cover",
    outputSchema: ClassroomCoverContentSchema,
    generatorKind: "gemini-image",
    cardVariant: "image-single",
    includedByDefault: true,
    eventName: "generate.classroom_cover.requested",
    fullWidth: true,
    showEdit: false,
  },
  calendar_cover: {
    key: "calendar_cover",
    label: "Calendar Cover",
    outputSchema: CalendarCoverContentSchema,
    generatorKind: "gemini-image",
    cardVariant: "image-single",
    includedByDefault: true,
    eventName: "generate.calendar_cover.requested",
    fullWidth: true,
    showEdit: false,
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
 * Order in which modules render on the package dashboard. All default-on
 * modules — cover and icon now flow through the generic CARD_COMPONENTS
 * dispatcher (PR #7) instead of being special-cased.
 */
export const DASHBOARD_MODULE_KEYS = MODULE_KEYS.filter(
  (k) => MODULE_REGISTRY[k].includedByDefault,
) as ModuleKey[];
