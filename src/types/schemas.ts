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

/**
 * Calendar (events) schemas.
 *
 * Skool's events are recurring (weekly / monthly / yearly) or a single dated
 * occurrence. The VA picks a recurrence type per event in the wizard; the
 * generator writes a short description per event. Storage keeps time as
 * 24-hour HH:mm in an IANA timezone — the export view formats it for humans
 * (e.g., "Every Monday at 9:00 AM PST", "The 15th of every month at 9:00 AM
 * PST", "Annually on May 8 at 9:00 AM PST").
 *
 * Recurrence is a discriminated union on `type`. Adding a new variant means
 * adding a branch here AND a branch in:
 *   - src/lib/calendar/format-schedule.ts (formatSchedule + describeRecurrence)
 *   - src/components/wizard/EventsRepeater.tsx (form UI)
 *   - tests covering each.
 *
 * Out of scope for now: nth-weekday-of-month patterns (e.g. "last Saturday")
 * and full RRULE string export — TODOs the day a real client needs them.
 */
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const CALENDAR_EVENT_TITLE_MAX = 60;
export const CALENDAR_EVENT_DESCRIPTION_MAX = 300;
export const CALENDAR_MAX_EVENTS = 10;
/**
 * Interval cap. A 12-month gap is the largest "monthly" cadence we accept;
 * past that, the event should be `yearly`. Keeps the dropdown small and the
 * describe helper readable.
 */
export const MONTHLY_INTERVAL_MAX = 12;

export const WeekdayEnum = z.enum([
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]);
export type Weekday = z.infer<typeof WeekdayEnum>;

const dayOfMonthField = z
  .number()
  .int()
  .min(1)
  .max(31);
const monthField = z.number().int().min(1).max(12);
const intervalField = z
  .number()
  .int()
  .min(1)
  .max(MONTHLY_INTERVAL_MAX);

/**
 * (month, dayOfMonth) pairs that can never occur in any year — Feb 30, Feb 31,
 * Apr/Jun/Sep/Nov 31. Feb 29 is intentionally allowed: yearly events can land
 * "leap year only" and Skool's calendar handles that fine; we don't try to be
 * clever about it.
 */
function isImpossibleDate(month: number, day: number): boolean {
  if (day < 1 || day > 31) return true;
  if (month === 2 && day > 29) return true;
  if ([4, 6, 9, 11].includes(month) && day === 31) return true;
  return false;
}

export const EventScheduleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('weekly'),
    dayOfWeek: WeekdayEnum,
    time: z.string().regex(TIME_24H_RE, 'Time must be HH:mm (24-hour)'),
    timezone: z.string().min(1),
  }),
  /**
   * Monthly: fires on `dayOfMonth` every `interval` months. dayOfMonth is
   * 1-31 with NO refinement against short months — months that don't have
   * that day (e.g. day 31 in Feb/Apr/Jun/Sep/Nov) are skipped by Skool's
   * calendar at render time. This matches RRULE BYMONTHDAY semantics and
   * avoids forcing the VA to pick "the 28th" just because Feb exists.
   */
  z.object({
    type: z.literal('monthly'),
    dayOfMonth: dayOfMonthField,
    interval: intervalField.default(1),
    time: z.string().regex(TIME_24H_RE, 'Time must be HH:mm (24-hour)'),
    timezone: z.string().min(1),
  }),
  /**
   * Yearly: fires on (month, dayOfMonth) once a year. The (month, day) pair
   * must be a real date — Feb 30, Apr 31, etc. are rejected. Feb 29 is
   * allowed and lands leap-year only.
   */
  z
    .object({
      type: z.literal('yearly'),
      month: monthField,
      dayOfMonth: dayOfMonthField,
      time: z.string().regex(TIME_24H_RE, 'Time must be HH:mm (24-hour)'),
      timezone: z.string().min(1),
    })
    .refine(
      (s) => !isImpossibleDate(s.month, s.dayOfMonth),
      {
        message: 'Date does not exist (e.g. Feb 30, Apr 31).',
        path: ['dayOfMonth'],
      },
    ),
  z.object({
    type: z.literal('one_off'),
    date: z.string().regex(ISO_DATE_RE, 'Date must be YYYY-MM-DD'),
    time: z.string().regex(TIME_24H_RE, 'Time must be HH:mm (24-hour)'),
    timezone: z.string().min(1),
  }),
]);
export type EventSchedule = z.infer<typeof EventScheduleSchema>;

export const CalendarEventSchema = z.object({
  title: z.string().min(1).max(CALENDAR_EVENT_TITLE_MAX),
  description: z.string().min(1).max(CALENDAR_EVENT_DESCRIPTION_MAX),
  schedule: EventScheduleSchema,
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarContentSchema = z.object({
  events: z.array(CalendarEventSchema).min(1).max(CALENDAR_MAX_EVENTS),
});
export type CalendarContent = z.infer<typeof CalendarContentSchema>;

/**
 * Intake: VA supplies title + schedule per event; descriptions are
 * AI-generated. Mirrors the classroom_titles → classroom items pattern.
 */
export const CalendarEventIntakeSchema = z.object({
  title: z.string().min(1).max(CALENDAR_EVENT_TITLE_MAX),
  schedule: EventScheduleSchema,
});
export type CalendarEventIntake = z.infer<typeof CalendarEventIntakeSchema>;

export const CalendarIntakeSchema = z.object({
  events: z.array(CalendarEventIntakeSchema).min(1).max(CALENDAR_MAX_EVENTS),
});
export type CalendarIntake = z.infer<typeof CalendarIntakeSchema>;

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
    // `courses` lived here historically but is now superseded by
    // `classroom_titles` (step 5). `events` likewise moved to
    // `calendar_intake.events`. Both were dropped from offer_breakdown
    // to remove duplicate intake surfaces — see CHANGELOG.
    perks: z.array(z.string()).default([]),
    guest_sessions: z.boolean().default(false),
  }),
  pricing: z.object({
    monthly: z.number().optional(),
    annual: z.number().optional(),
    /**
     * Skool supports two "additional" tiers beyond monthly/annual: Premium
     * and VIP, in that order. Names are locked because Skool's UI renders
     * them with fixed labels; only the price is creator-supplied. The
     * wizard cascade-removes VIP when Premium is removed to preserve
     * order — see `step-3.tsx`.
     */
    additional_tiers: z
      .array(
        z.object({
          name: z.enum(['Premium', 'VIP']),
          price: z.string(),
        }),
      )
      .max(2)
      .default([])
      .refine(
        (rows) => {
          if (rows.length === 0) return true;
          if (rows.length === 1) return rows[0].name === 'Premium';
          return rows[0].name === 'Premium' && rows[1].name === 'VIP';
        },
        {
          message:
            'Additional tiers must be ordered: Premium first, VIP second.',
        },
      ),
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
  // Add-on intake fields (PR #4 step 5). All optional during draft so existing
  // POST-then-PATCH flow stays compatible; final-submit validation enforces.
  // Always required at final-submit time: the classroom generator can't fan
  // out without at least one VA-supplied title. CreatorPatchSchema's
  // `.partial()` still lets autosave through during earlier wizard steps.
  classroom_titles: ClassroomTitlesSchema,
  calendar_intake: CalendarIntakeSchema.optional(),
  leaderboard_levels: LeaderboardContentSchema.shape.levels.optional(),
  categories: CategoriesContentSchema.shape.categories.optional(),
  discovery_keywords: DiscoverySeoContentSchema.shape.keywords.optional(),
});

export type CreatorIntake = z.infer<typeof CreatorIntakeSchema>;

/**
 * Submit schema — the strict shape required at final "Create launch
 * package" submission and at downstream generation. Identical to
 * CreatorIntakeSchema (kept as the canonical name to avoid churn in
 * the dozen sites that import it); CreatorSubmitSchema is the spec'd
 * alias for the autosave-vs-submit naming split.
 */
export const CreatorSubmitSchema = CreatorIntakeSchema;
export type CreatorSubmit = z.infer<typeof CreatorSubmitSchema>;

/**
 * Bootstrap schema — what the intake wizard POSTs on Step 1 completion
 * to create the draft row. Only the Step 1 fields are required; server
 * backfills DB NOT NULL columns with empty defaults for the remaining
 * fields, which PATCH fills in later.
 *
 * Renamed from `CreatorDraftSchema` so the autosave path (the much more
 * common usage) can claim the simpler `CreatorDraftSchema` name.
 */
export const CreatorStep1Schema = z.object({
  name: z.string().min(1).max(200),
  community_name: z.string().min(1).max(200),
  niche: NicheEnum,
  support_contact: z.string().min(1),
});
export type CreatorStep1 = z.infer<typeof CreatorStep1Schema>;

/**
 * Strip top-level empty-string and undefined fields. The wizard autosaves
 * `getValues()` every 30s; RHF defaults empty fields to `""` which
 * survives a structural validation but pollutes the audit log and the
 * empty-body refine. Stripping at the top level is enough — the
 * autosave schema below relaxes inner element constraints so that nested
 * empties (e.g. `classroom_titles: [""]` from the seed row) pass through.
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

/**
 * Permissive event schedule for the autosave path.
 *
 * The strict EventScheduleSchema is a discriminated union with per-variant
 * required fields (weekly: dayOfWeek, monthly: dayOfMonth + interval, ...).
 * The wizard's seed value is a `weekly` schedule whose `timezone` and `time`
 * are filled but a half-edited transition between recurrence types can land
 * a partial shape on the autosave snapshot. We accept any structurally
 * coherent superset and let final-submit re-validate against the strict
 * union.
 */
const LooseEventScheduleSchema = z
  .object({
    type: z.enum(['weekly', 'monthly', 'yearly', 'one_off']).optional(),
    dayOfWeek: WeekdayEnum.optional(),
    dayOfMonth: z.number().optional(),
    month: z.number().optional(),
    interval: z.number().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    timezone: z.string().optional(),
  })
  .passthrough();

const LooseCalendarEventIntakeSchema = z
  .object({
    title: z.string().optional(),
    schedule: LooseEventScheduleSchema.optional(),
  })
  .passthrough();

/**
 * Draft (autosave) schema — permissive structural validation.
 *
 * Why this exists: the wizard's autosave timer POSTs `getValues()` every
 * 30s on every step. On Steps 1-4 the form carries seed values for
 * Step 5 fields (`classroom_titles: [""]`, `calendar_intake.events[0]
 * .title: ""`, etc.) that the user hasn't filled yet. Those inner empty
 * strings fail `.min(1)` constraints on the strict schema, even after
 * top-level empty-string stripping — the constraint is on the array
 * element, not the array. The user sees a red "Invalid request body"
 * banner before they've typed anything.
 *
 * The fix is to validate structurally without enforcing content. Type
 * mismatches still fail (a string where pricing.monthly expects a
 * number). All content checks (min/max length, regex, refine) move
 * exclusively to CreatorSubmitSchema, which fires at final submit and
 * at downstream generation.
 *
 * Note: Zod v4 dropped `.deepPartial()`, so we hand-roll the permissive
 * shape rather than derive it from CreatorIntakeSchema. The leaf enums
 * (NicheEnum, ToneEnum, WeekdayEnum) are shared with the strict schema.
 */
export const CreatorDraftSchema = z.preprocess(
  stripEmptyStringFields,
  z
    .object({
      name: z.string().optional(),
      community_name: z.string().optional(),
      niche: NicheEnum.optional(),
      audience: z.string().optional(),
      transformation: z.string().optional(),
      tone: ToneEnum.optional(),
      offer_breakdown: z
        .object({
          perks: z.array(z.string()).optional(),
          guest_sessions: z.boolean().optional(),
        })
        .passthrough()
        .optional(),
      pricing: z
        .object({
          monthly: z.number().optional(),
          annual: z.number().optional(),
          additional_tiers: z
            .array(
              z
                .object({
                  // Accept any string for `name` — the strict ['Premium','VIP']
                  // enum + ordering refine apply at submit time.
                  name: z.string().optional(),
                  price: z.string().optional(),
                })
                .passthrough(),
            )
            .optional(),
        })
        .passthrough()
        .optional(),
      trial_terms: z
        .object({
          has_trial: z.boolean().optional(),
          duration_days: z.number().optional(),
        })
        .passthrough()
        .optional(),
      refund_policy: z.string().optional(),
      support_contact: z.string().optional(),
      brand_prefs: z.string().optional(),
      // Add-on fields. Inner element constraints intentionally relaxed —
      // an empty seed entry must not 400. Submit re-enforces .min(1) etc.
      classroom_titles: z.array(z.string()).optional(),
      calendar_intake: z
        .object({
          events: z.array(LooseCalendarEventIntakeSchema).optional(),
        })
        .passthrough()
        .optional(),
      leaderboard_levels: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      discovery_keywords: z.array(z.string()).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: 'At least one field must be provided.',
    }),
);

export type CreatorDraft = z.infer<typeof CreatorDraftSchema>;

/**
 * Deprecated alias — `CreatorDraftSchema` is now the autosave schema.
 * Kept so any out-of-tree callers don't break on the rename; remove in a
 * follow-up once nothing imports it.
 *
 * @deprecated Use CreatorDraftSchema instead.
 */
export const CreatorPatchSchema = CreatorDraftSchema;
/** @deprecated Use CreatorDraft instead. */
export type CreatorPatch = CreatorDraft;
