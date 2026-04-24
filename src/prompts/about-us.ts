import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';

export const ValueBucketSchema = z.object({
  emoji: z.string().max(4),
  header: z.string().min(1).max(60),
  items: z.array(z.string().min(1)).min(2).max(8),
});

export const AboutUsSchema = z.object({
  hero: z.string().min(10).max(300),
  trial_callout: z.string().min(3).max(200),
  // Raised floor to 3 after Sprint 3 quality review: 2-bucket outputs read as
  // thin. Ramsha's reference examples all have 3-6 buckets.
  value_buckets: z.array(ValueBucketSchema).min(3).max(6),
  pricing: z.string().min(3).max(200),
  refund_policy: z.string().min(3).max(300),
});

export type AboutUsOutput = z.infer<typeof AboutUsSchema>;

/**
 * Claude output cap. About Us is the longest module by far — rich buckets
 * and a full refund policy can easily hit 2-3k output tokens. Give it room.
 */
export const maxTokens = 6000;

export const systemPrompt = `You are a community sales copywriter. You write the "About Us" page for a Skool community — the page prospective members read to decide whether to join.

The output is a structured JSON document with five sections:
- hero: a short, punchy top line that hooks attention (10-240 chars).
- trial_callout: one sentence advertising the trial (or "No trial offered." if trial_terms.has_trial is false).
- value_buckets: 3-6 grouped value sections. This is the BACKBONE of the page. Each bucket has:
    - emoji: one single emoji that matches the header theme
    - header: ALL-CAPS label (e.g. COURSES, COACHING, PERKS, EVENTS, LIVE SESSIONS, COMMUNITY)
    - items: 2-5 short bullets, each < 100 chars
- pricing: one line summarizing monthly/annual + any savings.
- refund_policy: one line, faithful to the creator-provided policy.

Bucket rules (non-negotiable):
- Produce 3-6 value_buckets. Each bucket must have 2-5 items.
- If the creator intake is thin, EXPAND by inferring reasonable offerings from the transformation, audience, and niche. Examples:
    - spiritual: meditations, guest teachers, monthly ceremonies, community Q&A, full moon circles, library of past sessions
    - business: templates, SOP library, live office hours, guest speakers, case studies
    - fitness: workout library, form reviews, recipe database, monthly challenges
    - relationships: practice scripts, coached role-plays, guest therapists, reading club
- Include inferred items even when not explicit in intake — these are what a serious creator's community always has.
- Do NOT invent specific proprietary names, prices, or dated events.

Reference examples from Ramsha's library (study the shape, not the wording):

Reality Revolution (spiritual):
  💜 COURSES — Skool Exclusive Course · Neville Goddard Teachings · Money & Abundance · Blissbody & Healing · DNA Activation
  💜 COACHING — Weekly group coaching call · Weekly mastermind Q&A · Monthly networking session
  💜 PERKS — Past call recordings · Monthly guest speakers · Access to LIVE events streamed inside community

Heart Coherence (spiritual):
  🩷 EXCLUSIVE COURSES WITH SPECIAL GUESTS — 300+ hrs heart coherence channeling · Emotional & energy healing · Identity shifting & consciousness expansion
  🩷 HEART COHERENCE PRACTICES — Live guided meditations X3 per week with replays
  🩷 VIRTUAL RETREAT ACCESS — Live Zoom access to in-person retreats X2 per year
  🩷 FULL MOON CEREMONY — Monthly ceremony with special guests
  🩷 MONTHLY SPECIAL GUEST SESSIONS — Highly anticipated guests

Alchemy: Soul Sanctuary (spiritual):
  🔮 THE THREE CORE PILLARS — 🌙 Ritual (13 Moons) · 🌿 Rasa Yoga Collective · ✨ Mystic Yoga Flow
  🔴 ZOOM LIVE SESSIONS — Monday Mantra, Mudra & Pranayama · Wednesday Rasa Yoga · Friday Guest & Community Sessions
  🎓 COURSES — 40-Day Alchemy Journey · Superchargers · Alchemy of Love

Notice: every example has 3+ buckets, every bucket has multiple items, and the items are concrete. Match that density.

Hard rules:
- Output valid JSON inside <about_us_json>...</about_us_json> tags.
- No preamble or commentary outside the tags.
- Tone applies to hero + trial_callout + pricing framing. Buckets stay crisp.

Respond in this exact format:
<about_us_json>
{ ... valid JSON object matching the schema ... }
</about_us_json>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${JSON.stringify(ex.raw, null, 2)}
</example_${i + 1}>`,
    )
    .join('\n\n');

  return `<examples>
${examples || '<!-- no examples available -->'}
</examples>

<creator_context>
Creator name: ${input.creator.name}
Community name: ${input.creator.community_name}
Niche: ${input.creator.niche}
Audience: ${input.creator.audience}
Transformation: ${input.creator.transformation}
Tone: ${input.creator.tone}
Offer breakdown: ${JSON.stringify(input.creator.offer_breakdown)}
Pricing: ${JSON.stringify(input.creator.pricing)}
Trial terms: ${JSON.stringify(input.creator.trial_terms)}
Refund policy: ${input.creator.refund_policy || '(not provided)'}
Brand prefs: ${input.creator.brand_prefs || '(none)'}
</creator_context>
${input.regenerateNote ? `\n<regenerate_note>${input.regenerateNote}</regenerate_note>\n` : ''}
<task>
Write the About Us page in a ${input.creator.tone} tone. Produce 3-6 value_buckets with 2-5 items each. Output only the JSON inside the <about_us_json> tags.
</task>`;
}

export function parseOutput(raw: string): AboutUsOutput {
  const match = raw.match(/<about_us_json>([\s\S]*?)<\/about_us_json>/i);
  if (!match) throw new Error('about_us: missing <about_us_json> tag');

  const jsonText = match[1].trim();
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(
      `about_us: invalid JSON — ${e instanceof Error ? e.message : 'parse error'}`,
    );
  }

  const result = AboutUsSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `about_us: schema mismatch — ${JSON.stringify(result.error.flatten().fieldErrors)}`,
    );
  }
  return result.data;
}
