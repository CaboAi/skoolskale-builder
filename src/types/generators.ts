/**
 * Generator contracts — shared across prompt files, the Claude wrapper,
 * and the Inngest functions that compose them.
 *
 * See PRD §7.1 / .claude/agents/prompt-engineer.md for the spec.
 */
import type { Creator } from "@/lib/db/schema";
import type { CreatorIntake } from "@/types/schemas";
import type { ModuleKey } from "@/lib/modules/registry";

/**
 * The creator-level context every generator receives. This is a safe subset
 * of the full DB row (no `id`/`created_by`/timestamps) — everything needed
 * to write in the creator's voice and nothing that leaks identity IDs.
 *
 * Field names are snake_case to stay aligned with CreatorIntake and the DB
 * columns the prompts quote back at the reader.
 */
export type CreatorContext = Pick<
  CreatorIntake,
  | "name"
  | "community_name"
  | "niche"
  | "audience"
  | "transformation"
  | "tone"
  | "offer_breakdown"
  | "pricing"
  | "trial_terms"
  | "refund_policy"
  | "support_contact"
  | "brand_prefs"
  | "creator_photo_url"
> & {
  /**
   * Optional here because legacy DB rows may have null classroom_intake.
   * Required by CreatorIntakeSchema at wizard submit time. The classroom
   * prompt builder throws if absent so a misconfigured creator can't reach
   * Claude with an empty title list.
   */
  classroom_titles?: CreatorIntake["classroom_titles"];
  /**
   * Storage path (bucket-relative) for the creator photo. Set by the
   * signed-URLs migration so generators can read the bytes via
   * `storage.download()` instead of fetching the public URL. Coexists with
   * `creator_photo_url` during the migration window; the latter is dropped
   * after Stage 4 verifies signed-URL traffic in prod.
   */
  creator_photo_path?: string;
};

/**
 * One pattern library example ready to be injected as a few-shot sample.
 * The `content` field is the `example_content` jsonb payload stringified
 * to a prompt-safe shape (prompts decide how to render).
 */
export type PatternExample = {
  tone:
    | "warm"
    | "direct"
    | "playful"
    | "authoritative"
    | "inspirational"
    | "bold"
    | null;
  niche:
    | "spiritual"
    | "business"
    | "fitness"
    | "relationships"
    | "money"
    | "yoga"
    | "other"
    | null;
  sourceCreator: string | null;
  /** Stringified `example_content` — each prompt picks its own serialization. */
  content: string;
  /** Raw jsonb for prompts that want structure instead of a blob. */
  raw: unknown;
};

/**
 * What every generator's `buildUserMessage(input)` accepts.
 */
export type GeneratorInput = {
  creator: CreatorContext;
  patternLibrary: PatternExample[];
  /** When a VA regenerates with a note, pass it through. */
  regenerateNote?: string;
};

/**
 * Envelope returned by the shared `generate()` wrapper that each prompt's
 * `parseOutput(raw)` feeds into.
 */
export type GeneratorOutput<T> = {
  module: GeneratorModule;
  version: number;
  content: T;
};

export type GeneratorModule = ModuleKey;

/**
 * Convenience: build a CreatorContext from a DB Creator row. Strips
 * bookkeeping columns and widens the jsonb columns to the typed shapes
 * the prompts expect.
 */
export function toCreatorContext(row: Creator): CreatorContext {
  return {
    name: row.name,
    community_name: row.communityName,
    niche: row.niche,
    audience: row.audience,
    transformation: row.transformation,
    tone: row.tone,
    offer_breakdown: row.offerBreakdown as CreatorContext["offer_breakdown"],
    pricing: row.pricing as CreatorContext["pricing"],
    trial_terms: row.trialTerms as CreatorContext["trial_terms"],
    refund_policy: row.refundPolicy ?? "",
    support_contact: row.supportContact ?? "",
    brand_prefs: row.brandPrefs ?? "",
    creator_photo_url: row.creatorPhotoUrl ?? undefined,
    creator_photo_path: row.creatorPhotoPath ?? undefined,
    classroom_titles:
      (row.classroomIntake as CreatorContext["classroom_titles"]) ?? undefined,
  };
}
