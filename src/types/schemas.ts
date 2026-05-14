import { z } from 'zod';

/**
 * Shared Zod schemas — source of truth for both client and server validation.
 * Field names are snake_case to match DB column names; handlers map to
 * Drizzle's camelCase when persisting.
 */

export const NicheEnum = z.enum([
  'spiritual',
  'business',
  'fitness',
  'relationships',
  'money',
  'yoga',
  'other',
]);

export const ToneEnum = z.enum([
  'warm',
  'direct',
  'playful',
  'authoritative',
  'inspirational',
  'bold',
]);

/* -------------------------------------------------------------------------- */
/* Add-on module content schemas (PR #4)                                      */
/*                                                                            */
/* Each schema describes the persisted shape for one module. Used both as     */
/* the wizard step-5 form constraints AND (via MODULE_REGISTRY.outputSchema)  */
/* as the PATCH-route validator once the matching dashboard cards land in PR  */
/* #5. For now these modules have includedByDefault: false so the orchestrator*/
/* doesn't try to fan out to non-existent generators.                         */
/* -------------------------------------------------------------------------- */

/**
 * Classroom output is a list of `{title, description}` entries, one per
 * VA-supplied title. The title is echoed back by the generator (rather than
 * re-paired in code) so we can verify titles round-tripped unchanged and so
 * an edit-form mutation never desynchronises titles from descriptions.
 */
export const ClassroomItemSchema = z.object({
  title: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
});
export type ClassroomItem = z.infer<typeof ClassroomItemSchema>;

export const ClassroomContentSchema = z.object({
  items: z.array(ClassroomItemSchema).min(1).max(10),
});
export type ClassroomContent = z.infer<typeof ClassroomContentSchema>;

/** Intake: VA supplies 1-10 classroom titles; descriptions are AI-generated. */
export const ClassroomTitlesSchema = z
  .array(z.string().min(1).max(50))
  .min(1)
  .max(10);
export type ClassroomTitles = z.infer<typeof ClassroomTitlesSchema>;

export const CalendarContentSchema = z.object({
  title: z.string().min(1).max(30),
  description: z.string().min(1).max(300),
});
export type CalendarContent = z.infer<typeof CalendarContentSchema>;

/** Skool exposes 9 leaderboard levels; users name them all. Tuple, not array. */
export const LeaderboardContentSchema = z.object({
  levels: z
    .tuple([
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
    ]),
});
export type LeaderboardContent = z.infer<typeof LeaderboardContentSchema>;

/**
 * Skool defaults to 3 categories; the count stays fixed at 3.
 *
 * Categories are name-only — Skool's category UI doesn't accept a description
 * field, so generating one was wasted tokens and dead weight in the dashboard
 * + export view. Same shape as `LeaderboardContentSchema.levels` (tuple of N
 * non-empty strings).
 */
export const CategoriesContentSchema = z.object({
  categories: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
});
export type CategoriesContent = z.infer<typeof CategoriesContentSchema>;

/** Skool's Discovery search UI accepts up to 11 keywords. */
export const DiscoverySeoContentSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1).max(11),
});
export type DiscoverySeoContent = z.infer<typeof DiscoverySeoContentSchema>;

export const CreatorIntakeSchema = z.object({
  name: z.string().min(1).max(200),
  community_name: z.string().min(1).max(200),
  niche: NicheEnum,
  audience: z.string().min(1),
  transformation: z.string().min(1),
  tone: ToneEnum,
  offer_breakdown: z.object({
    courses: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
        }),
      )
      .default([]),
    perks: z.array(z.string()).default([]),
    events: z.array(z.string()).max(10).default([]),
    guest_sessions: z.boolean().default(false),
  }),
  pricing: z.object({
    monthly: z.number().optional(),
    annual: z.number().optional(),
    tiers: z
      .array(z.object({ name: z.string(), price: z.string() }))
      .default([]),
  }),
  trial_terms: z.object({
    has_trial: z.boolean(),
    // Pinned at 7 — the wizard no longer asks the VA for a duration. Kept
    // in the schema (rather than removed) so generators that read
    // `trial_terms.duration_days` continue to work unchanged. Use
    // `.default(7)` so older draft records lacking the field hydrate
    // cleanly on PATCH.
    duration_days: z.literal(7).default(7),
  }),
  refund_policy: z.string(),
  support_contact: z.string().min(1),
  brand_prefs: z.string(),
  creator_photo_url: z.string().url().optional(),
  // Add-on intake fields (PR #4 step 5). All optional during draft so existing
  // POST-then-PATCH flow stays compatible; final-submit validation enforces.
  // Always required at final-submit time: the classroom generator can't fan
  // out without at least one VA-supplied title. CreatorPatchSchema's
  // `.partial()` still lets autosave through during earlier wizard steps.
  classroom_titles: ClassroomTitlesSchema,
  calendar_intake: CalendarContentSchema.optional(),
  leaderboard_levels: LeaderboardContentSchema.shape.levels.optional(),
  categories: CategoriesContentSchema.shape.categories.optional(),
  discovery_keywords: DiscoverySeoContentSchema.shape.keywords.optional(),
});

export type CreatorIntake = z.infer<typeof CreatorIntakeSchema>;

/**
 * Patch schema — all fields optional for draft autosave.
 *
 * Two layers:
 *   1. z.preprocess strips empty-string fields before validation. The
 *      wizard autosaves the entire form state every 30s via getValues();
 *      Steps 1-4 leave fields like `audience` / `transformation` as
 *      empty strings (RHF defaults) until later steps are reached.
 *      Without stripping, those would hit CreatorIntakeSchema's
 *      .min(1) constraints inside .partial() and the PATCH 400s with
 *      "Invalid request body" — observed in the smoke session.
 *   2. .partial() makes every key optional at the shape level.
 *   3. .refine ensures the post-strip payload still has at least one
 *      field so we don't update audit log + updatedAt for a no-op.
 *
 * Final-submit goes through CreatorIntakeSchema (strict, no preprocess)
 * via the wizard's client-side trigger() and via downstream package
 * generation — draft leniency here doesn't leak into a published
 * launch package.
 */
const stripEmptyStringFields = (input: unknown): unknown => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return input;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (val === '' || val === undefined) continue;
    cleaned[key] = val;
  }
  return cleaned;
};

export const CreatorPatchSchema = z.preprocess(
  stripEmptyStringFields,
  CreatorIntakeSchema.partial().refine(
    (v) => Object.keys(v).length > 0,
    { message: 'At least one field must be provided.' },
  ),
);

export type CreatorPatch = z.infer<typeof CreatorPatchSchema>;

/**
 * Draft schema — what the intake wizard POSTs on Step 1 completion.
 * Only the Step 1 fields are required; server backfills DB NOT NULL columns
 * with empty defaults for the remaining fields, which PATCH fills in later.
 */
export const CreatorDraftSchema = z.object({
  name: z.string().min(1).max(200),
  community_name: z.string().min(1).max(200),
  niche: NicheEnum,
  support_contact: z.string().min(1),
  creator_photo_url: z.string().url().optional(),
});

export type CreatorDraft = z.infer<typeof CreatorDraftSchema>;
