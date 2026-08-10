/**
 * Shared fixtures for the handover prompt-module tests.
 *
 * Creator/GeneratedAsset are Drizzle row types; like the other test suites
 * we build minimal row-shaped objects and `as`-cast them (the brief builder
 * only reads a known subset of columns).
 *
 * FULL_BRIEF / MINIMAL_BRIEF are hand-constructed HandoverBrief values —
 * independent of buildHandoverBrief — so formatBrief/readme/system-block
 * tests never use the builder under test as their own oracle.
 */
import type { Creator, GeneratedAsset } from "@/lib/db/schema";
import type { HandoverBrief } from "@/prompts/handover/brief";

export function makeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: "cr-1",
    name: "Jane Doe",
    communityName: "Soul Collective",
    niche: "spiritual",
    tone: "warm",
    transformation: "reclaim your power",
    audience: "women 30-55",
    offerBreakdown: {
      perks: ["Monthly Q&A", "Templates"],
      guest_sessions: true,
    },
    pricing: {
      monthly: 27,
      annual: 227,
      additional_tiers: [{ name: "VIP", price: "$57/mo or $477/yr" }],
    },
    trialTerms: { has_trial: false, duration_days: 7 },
    refundPolicy: "14-day refund",
    supportContact: "support@example.test",
    brandPrefs: "purple palette",
    createdBy: "user-1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  } as Creator;
}

export function makeAsset(module: string, content: unknown): GeneratedAsset {
  return {
    id: `asset-${module}`,
    packageId: "pkg-1",
    module,
    version: 1,
    content,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    editHistory: [],
    vaNotes: null,
    qualityScore: null,
    createdBy: "user-1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
  } as GeneratedAsset;
}

/** One latest asset per module the brief builder reads. */
export function makeAssets(): GeneratedAsset[] {
  return [
    makeAsset("about_us", { pricing: "Standard: $27/mo or $227/yr" }),
    makeAsset("transformation", {
      candidates: ["From burned out to grounded", "Second-choice line"],
    }),
    makeAsset("classroom", {
      items: [
        { title: "Foundations", description: "Start here" },
        { title: "Deep Work", description: "Go deeper" },
      ],
    }),
    makeAsset("calendar", {
      events: [
        {
          title: "Weekly Q&A",
          description: "Live questions",
          schedule: {
            type: "weekly",
            dayOfWeek: "mon",
            interval: 1,
            time: "09:00",
            timezone: "America/Los_Angeles",
          },
        },
        {
          title: "Breathwork",
          schedule: {
            type: "weekly",
            dayOfWeek: "wed",
            interval: 1,
            time: "18:00",
            timezone: "America/Los_Angeles",
          },
        },
      ],
    }),
    makeAsset("leaderboard", { levels: ["Seeker", "Guide", "Sage"] }),
    makeAsset("categories", { categories: ["Wins", "Questions"] }),
  ];
}

/** Every optional field populated; annual pricing on. */
export const FULL_BRIEF: HandoverBrief = {
  creator: "Jane Doe",
  creatorFirst: "Jane",
  community: "Soul Collective",
  slug: "soul-collective",
  niche: "spiritual",
  tone: "warm",
  transformation: "reclaim your power",
  transformationLine: "From burned out to grounded",
  audience: "women 30-55",
  supportEmail: "support@example.test",
  guestSessions: true,
  perks: "Monthly Q&A; Templates",
  trial: "No trial",
  refund: "14-day refund",
  brandPrefs: "purple palette",
  pricing: {
    tiers: [
      { name: "Standard", monthly: "$27/mo", annual: "$227/yr" },
      { name: "VIP", monthly: "$57/mo", annual: "$477/yr" },
    ],
    hasAnnual: true,
    freeTier: true,
  },
  modules: ["Foundations", "Deep Work"],
  calls: [
    { name: "Weekly Q&A", when: "Every Monday at 9:00 AM PST", blurb: null },
    { name: "Breathwork", when: null, blurb: "Monthly session" },
  ],
  levels: ["Seeker", "Guide", "Sage"],
  categories: ["Wins", "Questions"],
};

/** Every optional field empty/null; no annual pricing. */
export const MINIMAL_BRIEF: HandoverBrief = {
  creator: "Bo Smith",
  creatorFirst: "Bo",
  community: "Iron Circle",
  slug: "iron-circle",
  niche: "fitness",
  tone: "bold",
  transformation: "get strong without burning out",
  transformationLine: null,
  audience: "men 25-45",
  supportEmail: null,
  guestSessions: false,
  perks: null,
  trial: "7-day trial",
  refund: null,
  brandPrefs: null,
  pricing: {
    tiers: [{ name: "Standard", monthly: "$27/mo", annual: null }],
    hasAnnual: false,
    freeTier: true,
  },
  modules: [],
  calls: [],
  levels: [],
  categories: [],
};
