import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';

export const ValueBucketSchema = z.object({
  emoji: z.string().max(4),
  header: z.string().min(1).max(60),
  items: z.array(z.string().min(1)).min(1).max(8),
});

export const AboutUsSchema = z.object({
  hero: z.string().min(10).max(300),
  trial_callout: z.string().min(3).max(200),
  value_buckets: z.array(ValueBucketSchema).min(2).max(5),
  pricing: z.string().min(3).max(200),
  refund_policy: z.string().min(3).max(300),
});

export type AboutUsOutput = z.infer<typeof AboutUsSchema>;

export const systemPrompt = `You are a community sales copywriter. You write the "About Us" page for a Skool community — the page prospective members read to decide whether to join.

The output is a structured JSON document with five sections:
- hero: a short, punchy top line that hooks attention (10-240 chars).
- trial_callout: one sentence advertising the trial (or "No trial offered." if trial_terms.has_trial is false).
- value_buckets: 2-5 grouped value sections. Each bucket has:
    - emoji: one single emoji that matches the header theme
    - header: ALL-CAPS label (e.g. COURSES, COACHING, PERKS, EVENTS)
    - items: 1-8 short bullets, each < 100 chars
- pricing: one line summarizing monthly/annual + any savings.
- refund_policy: one line, faithful to the creator-provided policy.

Hard rules:
- Output valid JSON inside <about_us_json>...</about_us_json> tags.
- No preamble or commentary outside the tags.
- Every string pulls from the creator context — do not invent offers, prices, or perks that aren't provided.
- Tone applies to hero + trial_callout + pricing framing. Buckets stay crisp.
- If a value area (e.g. no events) is empty in the creator context, omit that bucket — don't pad with fiction.

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
Write the About Us page in a ${input.creator.tone} tone. Output only the JSON inside the <about_us_json> tags.
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
