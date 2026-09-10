/**
 * Handover deliverable registry — the canonical 6-file client package.
 *
 * Ported from the Skool_Skale_DFY CLI (cli/prompts.py DELIVERABLES),
 * renumbered to the canonical set in assets/handover-structure.md: the long
 * VSL doubles as the About-Us page script (no separate about-us file) and
 * the docuseries ships word-for-word only (no talking-points file).
 *
 * Pure module — no `server-only`, no DB, no fs. Doc keys are defined here
 * (not imported from the DB schema) so this stays client-safe; a unit test
 * asserts they match `handoverDocKeyEnum`.
 */

export const HANDOVER_GENERATED_DOC_KEYS = [
  "vsl_and_cancellation",
  "pre_launch_emails",
  "post_launch_emails",
  "docuseries_full_script",
  "dm_sequences",
] as const;

export type HandoverGeneratedDocKey =
  (typeof HANDOVER_GENERATED_DOC_KEYS)[number];

export type HandoverDocKey = HandoverGeneratedDocKey | "readme";

export const HANDOVER_DOC_LABELS: Record<HandoverDocKey, string> = {
  readme: "README + placeholder checklist",
  vsl_and_cancellation: "VSL + Cancellation Scripts",
  pre_launch_emails: "Pre-Launch Emails",
  post_launch_emails: "Post-Launch Emails",
  docuseries_full_script: "Docuseries — Full Script",
  dm_sequences: "DM Sequences",
};

export const HANDOVER_DOC_FILENAMES: Record<HandoverDocKey, string> = {
  readme: "00-README.md",
  vsl_and_cancellation: "01-vsl-and-cancellation.md",
  pre_launch_emails: "02-pre-launch-emails.md",
  post_launch_emails: "03-post-launch-emails.md",
  docuseries_full_script: "04-docuseries-full-script.md",
  dm_sequences: "05-dm-sequences.md",
};

/**
 * Per-run facts that change what a deliverable is asked to produce, as
 * opposed to how it's written (that lives in the framework assets).
 */
export type HandoverTaskContext = {
  /** Operator confirmed real launch guests — unlocks the guest email sequence. */
  includeGuestEmails: boolean;
  /**
   * A permanently free community tier exists. NOT the free trial: most
   * communities are trial-then-pay, and asking for free-tier copy there
   * produces an offer the creator cannot honour.
   */
  freeCommunity: boolean;
};

export type HandoverDeliverable = {
  docKey: HandoverGeneratedDocKey;
  num: string;
  title: string;
  /** Framework reference file in assets/ embedded verbatim in the user prompt. */
  referenceAsset: string;
  /** Gold example file(s) in assets/. Guest-email example joins only when confirmed. */
  templateAssets: (includeGuestEmails: boolean) => string[];
  /** Short task instruction; framework detail lives in the reference file. */
  buildTask: (ctx: HandoverTaskContext) => string;
};

export const HANDOVER_DELIVERABLES: HandoverDeliverable[] = [
  {
    docKey: "vsl_and_cancellation",
    num: "01",
    title: "VSL + Cancellation",
    referenceAsset: "vsl-long-and-cancellation.md",
    templateAssets: () => ["example-vsl-cancellation.md"],
    buildTask: ({ freeCommunity }) =>
      "Write TWO first-person scripts in one file: (A) the long VSL (~3–5 min) and (B) the " +
      "cancellation/retention video (~2–3 min). The VSL walks all tiers " +
      (freeCommunity
        ? "(free = feel it out, entry paid = the system, top = all-in)"
        : "(entry paid = the system, top = all-in)") +
      ", names real modules + calls, lands 'the real " +
      "transformation is the room', states the founder-rate offer once. This VSL is ALSO the " +
      "About-Us page script — it must stand alone there. The cancellation offers the downgrade " +
      "LADDER that fits this community " +
      (freeCommunity ? "(top→entry→free→pause)" : "(top→entry→pause)") +
      " — money-back ONLY if the refund " +
      "policy allows it — and names the real losses. Include CTA button rows.\n" +
      (freeCommunity
        ? ""
        : "This community is PAID-ONLY: there is no free community and no free tier. Do NOT " +
          "offer one as an entry point, a CTA, or a cancellation downgrade. The free trial is " +
          "NOT a free tier — describe it only as a trial of the paid membership that converts " +
          "to billing, never as free access or a way to stay for free.\n") +
      "Structure: `# <Community> — VSL + Cancellation Video Scripts`, then " +
      "`## VSL Script (~3–5 min · first person)`, then `## Cancellation Video Script (~2–3 min · first person)`.",
  },
  {
    docKey: "pre_launch_emails",
    num: "02",
    title: "Pre-Launch Emails",
    referenceAsset: "pre-launch-emails.md",
    templateAssets: (includeGuestEmails) =>
      includeGuestEmails
        ? ["example-pre-launch-emails.md", "example-pre-launch-guest-emails.md"]
        : ["example-pre-launch-emails.md"],
    buildTask: ({ includeGuestEmails, freeCommunity }) =>
      "Write the pre-launch email sequence: 7 host emails (from the creator) building to the " +
      "2-part docuseries event, each driving to " +
      (freeCommunity
        ? "the free community pre-event and to Episode 1 at launch"
        : "the event registration pre-event and to Episode 1 at launch — this community is " +
          "PAID-ONLY, so never send anyone to a free community or free tier; the pre-event " +
          "destination is the event/waitlist signup, not a free membership") +
      ". Reuse the docuseries Ep1 problem beats so emails + film feel like one story. " +
      "Merge tag `{{firstName}}`.\n" +
      (includeGuestEmails
        ? "The operator CONFIRMED launch guests: ALSO produce a 5-email guest-speaker sequence " +
          "(POV = the guest, to their own list, signs `[[GUEST NAME]]`).\n"
        : "Do NOT produce a guest-speaker email sequence — the operator has not confirmed " +
          "launch guests, even if the DNA mentions guest sessions.\n") +
      "Structure: `# <Community> — Pre-Launch Email Sequence`, `## Host Sequence` with " +
      "`### Email #1 — Day -9` (Subject: then body) through #7" +
      (includeGuestEmails
        ? ", then `## Guest-Speaker Emails (sent by the guest to their list)`."
        : "."),
  },
  {
    docKey: "post_launch_emails",
    num: "03",
    title: "Post-Launch Emails",
    referenceAsset: "post-launch-emails.md",
    templateAssets: () => ["example-post-launch-emails.md"],
    buildTask: () =>
      "Write the post-launch email sequence: ~10 emails from the creator, sent after Episode 2 " +
      "drops / doors open, converting the warmed list before the founding window closes. Vary " +
      "the shape (single-story, teaching, direct pitch). Arc: doors-open → transformation " +
      "stories ([[PROOF]]) → momentum/testimonials → objection-crush → founder-rate urgency → " +
      "cost reframe → last call. Every email = ONE CTA line `[Join <Community>] → [[SKOOL JOIN LINK]]`. " +
      "Merge tag `{{firstName}}`. Never fabricate results — all stories/quotes are placeholders.\n" +
      "Structure: `# <Community> — Post-Launch Email Sequence` + meta, then " +
      "`### Email #1 — Day 0 (Doors Open)` with `**Subject:**` then body, through #10.",
  },
  {
    docKey: "docuseries_full_script",
    num: "04",
    title: "Docuseries — Full Script",
    referenceAsset: "docuseries-framework.md",
    templateAssets: () => ["example-docuseries-framework.md"],
    buildTask: () =>
      "Write the docuseries as a first-person, word-for-word teleprompter script in TWO " +
      "episodes: Episode 1 — The Problem (cold open → authority → identify → deepen → " +
      "breadcrumb), Episode 2 — The Solution = the community (re-affirm → reveal → results → " +
      "pitch the community with real modules/calls/tiers/levels → offer + founder rate → CTA). " +
      "One idea per line, spoken cadence; stage directions in [brackets] on their own line; " +
      "`[[placeholders]]` for story/proof/dates. Keep the peptide/finance talk high-level.\n" +
      'Structure: `# <Community> — Docuseries Full Script` + meta, `## Episode 1 — The Problem`, ' +
      '`## Episode 2 — The Solution`, ending with `**[CTA Button: "Join <Community>"]**`.',
  },
  {
    docKey: "dm_sequences",
    num: "05",
    title: "DM Sequences",
    referenceAsset: "dm-sequences.md",
    templateAssets: () => ["example-dm-sequences.md"],
    buildTask: ({ freeCommunity }) =>
      "Produce the full Skoot DM lifecycle with `#NAME#` / `#GROUPNAME#` merge tags, grouped by " +
      "flow then tier, using the real calls/modules/prices/upgrade steps: Welcome per paid tier " +
      "(add calls to calendar, start Classroom, upgrade path to the higher tier leading annual); " +
      (freeCommunity
        ? "Free-tier nurture (~6 DMs, honest, value-first, soft upgrade — don't over-DM); "
        : "") +
      "Declined " +
      "card (2 DMs, retry window `[[N]]`, no shaming); Cancellation per paid tier (3 DMs each, " +
      "raw + honest, reframe what's really lost = the room/current info/calls, off-ramp down a " +
      (freeCommunity ? "tier or to free" : "tier or to a pause") +
      "). Anchor tone to the DNA Welcome DM. No fabricated results.\n" +
      (freeCommunity
        ? ""
        : "This community is PAID-ONLY: produce NO free-tier nurture sequence and never offer " +
          "a free tier as a cancellation off-ramp. The free trial is not a free tier.\n") +
      "Structure: `# <Community> — Skoot DM Sequences` then `## Welcome — <Tier>` sections, " +
      (freeCommunity ? "`## Free-Tier Nurture`, " : "") +
      "`## Declined Card`, `## Cancellation — <Tier>`. Label each DM with timing.",
  },
];
