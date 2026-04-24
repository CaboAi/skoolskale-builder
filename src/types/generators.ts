/**
 * Generator contracts — shared across prompt files, the Claude wrapper,
 * and the Inngest functions that compose them.
 *
 * See PRD §7.1 / .claude/agents/prompt-engineer.md for the spec.
 */
import type { Creator } from '@/lib/db/schema';
import type { CreatorIntake } from '@/types/schemas';

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
  | 'name'
  | 'community_name'
  | 'niche'
  | 'audience'
  | 'transformation'
  | 'tone'
  | 'offer_breakdown'
  | 'pricing'
  | 'trial_terms'
  | 'refund_policy'
  | 'support_contact'
  | 'brand_prefs'
  | 'creator_photo_url'
>;

/**
 * One pattern library example ready to be injected as a few-shot sample.
 * The `content` field is the `example_content` jsonb payload stringified
 * to a prompt-safe shape (prompts decide how to render).
 */
export type PatternExample = {
  tone: 'loving' | 'direct' | 'playful' | null;
  niche:
    | 'spiritual'
    | 'business'
    | 'fitness'
    | 'relationships'
    | 'money'
    | 'yoga'
    | 'other'
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

export type GeneratorModule =
  | 'welcome_dm'
  | 'transformation'
  | 'about_us'
  | 'start_here';

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
    offer_breakdown: row.offerBreakdown as CreatorContext['offer_breakdown'],
    pricing: row.pricing as CreatorContext['pricing'],
    trial_terms: row.trialTerms as CreatorContext['trial_terms'],
    refund_policy: row.refundPolicy ?? '',
    support_contact: row.supportContact ?? '',
    brand_prefs: row.brandPrefs ?? '',
    creator_photo_url: row.creatorPhotoUrl ?? undefined,
  };
}
