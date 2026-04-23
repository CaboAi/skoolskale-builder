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

export const ToneEnum = z.enum(['loving', 'direct', 'playful']);

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
