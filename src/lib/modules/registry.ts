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

export type ModuleKey =
  | "welcome_dm"
  | "transformation"
  | "about_us"
  | "start_here"
  | "cover";

export type GeneratorKind = "claude-text" | "gemini-image" | "passthrough";

/**
 * Renderer-component lookup key. PR #3 wires four variants:
 *   simple-text -> TextModuleCard (welcome_dm + transformation)
 *   about-us    -> AboutUsCard
 *   start-here  -> StartHereCard
 *   cover       -> CoverCard
 *
 * Forward-declared for future module additions (no map entry yet — a
 * runtime guard in PackageDashboard throws if an unwired variant ships).
 */
export type CardVariant =
  | "simple-text"
  | "about-us"
  | "start-here"
  | "cover"
  | "image"
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
    cardVariant: "cover",
    includedByDefault: true,
    eventName: "generate.cover.requested",
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

/** Modules included by default, excluding the special-cased cover module. */
export const COPY_MODULE_KEYS = MODULE_KEYS.filter(
  (k) => k !== "cover" && MODULE_REGISTRY[k].includedByDefault,
) as ModuleKey[];
