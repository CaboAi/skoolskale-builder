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

export const ClassroomContentSchema = z.object({
  title: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
});
export type ClassroomContent = z.infer<typeof ClassroomContentSchema>;

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

/** Skool defaults to 3 categories; this PR keeps the count fixed at 3. */
export const CategoriesContentSchema = z.object({
  categories: z.tuple([
    z.object({ name: z.string().min(1), description: z.string().min(1) }),
    z.object({ name: z.string().min(1), description: z.string().min(1) }),
    z.object({ name: z.string().min(1), description: z.string().min(1) }),
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
    live_calls: z.string().optional(),
    perks: z.array(z.string()).default([]),
    events: z.array(z.string()).default([]),
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
    duration_days: z.number().optional(),
  }),
  refund_policy: z.string(),
  support_contact: z.string().min(1),
  brand_prefs: z.string(),
  creator_photo_url: z.string().url().optional(),
  // Add-on intake fields (PR #4 step 5). All optional during draft so existing
  // POST-then-PATCH flow stays compatible; final-submit validation enforces.
  classroom_intake: ClassroomContentSchema.optional(),
  calendar_intake: CalendarContentSchema.optional(),
  leaderboard_levels: LeaderboardContentSchema.shape.levels.optional(),
  categories: CategoriesContentSchema.shape.categories.optional(),
  discovery_keywords: DiscoverySeoContentSchema.shape.keywords.optional(),
});

export type CreatorIntake = z.infer<typeof CreatorIntakeSchema>;

/**
 * Patch schema — all fields optional for draft autosave.
 * Rejects empty payloads so PATCH always has at least one change.
 */
export const CreatorPatchSchema = CreatorIntakeSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'At least one field must be provided.' },
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
