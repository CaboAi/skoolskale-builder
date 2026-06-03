import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';
import { regenerateNoteSuffix } from './_shared';
import { renderAboutUsText } from '@/lib/modules/render';
import { CapViolationError } from '@/lib/inngest/cap-violation';

/**
 * Skool's About Us field truncates around 1,050 chars rendered. Two
 * real deployed examples landed at 971 and 1,028 chars. Generate to
 * ~900 to leave slack for VA edits.
 */
export const ABOUT_US_MAX_CHARS = 1050;
export const ABOUT_US_TARGET_MIN = 750;

export const ValueBucketSchema = z.object({
  emoji: z.string().max(4),
  header: z.string().min(1).max(60),
  // One tight line per bucket — the Skool char cap leaves no room for
  // multi-item bullet lists. `items` stays as an array (instead of
  // collapsing to a single string) so the renderer stays one-shape and
  // legacy multi-item assets render without a migration.
  items: z.array(z.string().min(1).max(140)).length(1),
});

/**
 * Structural shape only — field-level constraints. Exposed so the parser
 * can run a structural-only validation pass before checking the rendered
 * length, which avoids firing the cap-violation retry path for issues
 * that aren't actually about length.
 */
export const AboutUsStructuralSchema = z.object({
  hero: z.string().min(10).max(240),
  trial_callout: z.string().min(3).max(160),
  value_buckets: z.array(ValueBucketSchema).min(1).max(3),
  pricing: z.string().min(3).max(160),
  refund_policy: z.string().min(3).max(220),
});

/**
 * Full schema with the Skool char-cap refinement. Used by the edit form
 * (zodResolver) so VAs can't save over-cap edits, and by any direct
 * `AboutUsSchema.parse(...)` callers.
 */
export const AboutUsSchema = AboutUsStructuralSchema.superRefine(
  (data, ctx) => {
    const len = renderAboutUsText(data).length;
    if (len > ABOUT_US_MAX_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `About Us is ${len} chars (cap: ${ABOUT_US_MAX_CHARS})`,
      });
    }
  },
);

export type AboutUsOutput = z.infer<typeof AboutUsSchema>;

/**
 * Claude output cap. About Us is one of the longer modules but the new
 * char ceiling lets us tighten the token budget materially.
 */
export const maxTokens = 3000;

export const systemPrompt = `You are a community sales copywriter. You write the "About Us" page for a Skool community — the page prospective members read to decide whether to join.

The output is a structured JSON document with five sections:
- hero: a short, punchy top line that hooks attention (10-240 chars).
- trial_callout: one sentence advertising the trial (or "No trial offered." if trial_terms.has_trial is false).
- value_buckets: 1-3 grouped value sections. Each bucket has:
    - emoji: one single emoji that matches the header theme
    - header: ALL-CAPS label (e.g. COURSES, COACHING, PERKS, EVENTS, LIVE SESSIONS)
    - items: an array of EXACTLY ONE string — one tight line, max 18 words, NOT a bullet list.
- pricing: one line summarizing monthly/annual + any savings.
- refund_policy: one line, faithful to the creator-provided policy.

Hard length constraint (NON-NEGOTIABLE):
- Total rendered output must be ${ABOUT_US_TARGET_MIN}-${ABOUT_US_MAX_CHARS} characters when concatenated with newlines (hero, blank, trial_callout, blank, buckets joined by blank lines, blank, pricing, blank, refund_policy).
- Skool's About Us field truncates above ~${ABOUT_US_MAX_CHARS} chars. Count characters before outputting. Rewrite if over.
- A bucket renders as "{emoji} {header}\\n{line}" — count emojis as 1-2 chars each.

Structure constraints (NON-NEGOTIABLE):
- Maximum 3 value buckets. Three is the target; two is acceptable when the offer is small.
- Each bucket: 1 emoji + 1 heading + 1 line. No bullet lists inside buckets. No multi-line bucket bodies.
- The hero carries the transformation hook. Buckets carry concrete differentiated value. Pricing + refund close the sale.

What to keep:
- A strong hero line tied to the transformation.
- 2-3 buckets that name distinct value pillars (courses, coaching, community events, exclusive perks — choose what fits the offer).
- One clean pricing line.
- One clean refund line.

What to cut (these always blow the cap):
- More than 3 buckets.
- Multi-line bucket bodies. ONE line per bucket.
- Redundant feature lists (don't restate the bucket header inside the line).
- Long refund policies — distill to one sentence.

Output rules:
- Output valid JSON inside <about_us_json>...</about_us_json> tags. No preamble outside the tags.
- Do NOT invent specific proprietary names, prices, or dated events not in the intake.

Voice calibration (applies to hero + trial_callout + pricing framing — bucket lines stay crisp):
- "warm": nurturing, inclusive — "you'll find / we / together". No spiritual-influencer register.
- "direct": no fluff. Who it's for, what they get, what it costs.
- "playful": light wordplay, casual register.
- "authoritative": expert, declarative. Industry vocabulary used precisely. No exclamation marks.
- "inspirational": vision-forward, grounded by one concrete outcome.
- "bold": high-energy declarative. Short punchy sentences. Strong verbs. No hedging.

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

<task>
Write the About Us page in a ${input.creator.tone} tone. Produce 2-3 value_buckets, each with exactly one short line (max 18 words). Total rendered output must be ${ABOUT_US_TARGET_MIN}-${ABOUT_US_MAX_CHARS} characters — aim for the upper end when the offer supports it, and never exceed ${ABOUT_US_MAX_CHARS}. Output only the JSON inside the <about_us_json> tags.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
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

  // Schema parse first — structural mismatches are not cap problems, so
  // we don't want to fire the cap retry for them.
  const structural = AboutUsStructuralSchema.safeParse(data);
  if (!structural.success) {
    throw new Error(
      `about_us: schema mismatch — ${JSON.stringify(structural.error.flatten().fieldErrors)}`,
    );
  }

  // Now check rendered length and throw the typed cap error so the
  // factory can fire one retry with concrete numbers.
  const rendered = renderAboutUsText(structural.data);
  if (rendered.length > ABOUT_US_MAX_CHARS) {
    throw new CapViolationError({
      module: 'about_us',
      moduleLabel: 'About Us',
      actualChars: rendered.length,
      maxChars: ABOUT_US_MAX_CHARS,
      rawOutput: raw,
    });
  }

  // Final defense-in-depth: run the full schema (including .superRefine)
  // so callers that import AboutUsSchema directly (edit form, tests)
  // see identical validation.
  return AboutUsSchema.parse(structural.data);
}
