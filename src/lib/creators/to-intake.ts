/**
 * Creator row -> intake form values.
 *
 * The intake wizard writes snake_case `CreatorIntake` and the DB stores
 * camelCase columns, so editing an existing creator needs the trip back.
 * Nullable columns and jsonb blobs hydrate to the same empty shapes the
 * wizard seeds, so a row saved before a field existed still renders a
 * usable control instead of an uncontrolled input.
 *
 * Where a field already has a schema, the blob is run through it rather
 * than length-checked by hand: `leaderboard_levels` and `categories` are
 * fixed-length tuples, and a legacy row holding the wrong shape should
 * fall back to the empty control instead of failing the render.
 *
 * Pure module — type-only DB import, no `server-only`, no fs.
 */
import type { Creator } from "@/lib/db/schema";
import {
  CalendarIntakeSchema,
  CategoriesContentSchema,
  ClassroomTitlesSchema,
  DiscoverySeoContentSchema,
  LeaderboardContentSchema,
  type CreatorIntake,
} from "@/types/schemas";

/** Parsed value, or undefined when the stored blob does not fit the schema. */
function parsed<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  value: unknown,
): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function asArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The wizard seeds one blank row so the repeater renders on first paint. */
const BLANK_CLASSROOM_TITLES = [""];

export function creatorToIntake(creator: Creator): CreatorIntake {
  const offer = asRecord(creator.offerBreakdown);
  const pricing = asRecord(creator.pricing);
  const trial = asRecord(creator.trialTerms);

  return {
    name: creator.name,
    community_name: creator.communityName,
    niche: creator.niche,
    audience: creator.audience,
    transformation: creator.transformation,
    tone: creator.tone,
    offer_breakdown: {
      perks: asArray<string>(offer.perks) ?? [],
      guest_sessions: offer.guest_sessions === true,
    },
    pricing: {
      monthly: typeof pricing.monthly === "number" ? pricing.monthly : undefined,
      annual: typeof pricing.annual === "number" ? pricing.annual : undefined,
      // Absent on every row created before the flag existed, and absent
      // means paid-only. Never widen this to a truthy default: the handover
      // brief states it to Claude as fact.
      free_community: pricing.free_community === true,
      additional_tiers:
        asArray<{ name: "Premium" | "VIP"; price: string }>(
          pricing.additional_tiers,
        ) ?? [],
    },
    trial_terms: {
      has_trial: trial.has_trial === true,
      duration_days: 7,
    },
    refund_policy: creator.refundPolicy ?? "",
    support_contact: creator.supportContact ?? "",
    brand_prefs: creator.brandPrefs ?? "",
    classroom_titles:
      parsed(ClassroomTitlesSchema, creator.classroomIntake) ??
      BLANK_CLASSROOM_TITLES,
    calendar_intake: parsed(CalendarIntakeSchema, creator.calendarIntake),
    leaderboard_levels: parsed(
      LeaderboardContentSchema.shape.levels,
      creator.leaderboardLevels,
    ),
    categories: parsed(
      CategoriesContentSchema.shape.categories,
      creator.categories,
    ),
    discovery_keywords: parsed(
      DiscoverySeoContentSchema.shape.keywords,
      creator.discoveryKeywords,
    ),
  };
}
