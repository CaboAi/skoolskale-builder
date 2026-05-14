import {
  DiscoverySeoContentSchema,
  type DiscoverySeoContent,
} from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';
import { regenerateNoteSuffix } from './_shared';

const TARGET_KEYWORDS = 11; // Skool's max as of v1.1
const KEYWORD_MAX = 40;

export const systemPrompt = `You are an SEO copywriter producing Skool Discovery search keywords.

Skool's Discovery surface is a search-ranked directory; communities tagged with the right keywords surface to people searching them. Your output is a flat list of search keywords/phrases (not categories, not tags).

Your job: produce ${TARGET_KEYWORDS} keywords/phrases that match how the creator's audience would actually type a search. Mix:
- Niche identifiers (e.g., "yoga teachers", "small business owners")
- Transformation outcomes (e.g., "morning routine", "hire your first VA")
- Audience descriptors (e.g., "moms over 40", "first-time founders")
- Format/modality words ONLY if differentiating (e.g., "live coaching" vs generic "community")

Hard rules:
- Exactly ${TARGET_KEYWORDS} keywords.
- Each keyword: 1-${KEYWORD_MAX} characters. Lowercase. No quotes. No hashtags. No emojis.
- Multi-word phrases are fine (e.g., "soul-led entrepreneurs"). 1-4 words each.
- No duplicates. No near-duplicates ("yoga" + "yoga community" is fine; "yoga" + "yoga ").
- Avoid generic SEO bloat ("community", "online", "free") unless it materially distinguishes.
- No brand-name keywords (don't try to rank for "Skool" or competitor names).
- No preamble.

Respond in this exact format:
<discovery_seo>
<keyword>kw 1</keyword>
<keyword>kw 2</keyword>
... 11 total ...
</discovery_seo>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  const offer = input.creator.offer_breakdown;
  const offerHints: string[] = [];
  if (offer.courses?.length) {
    offerHints.push(
      `courses: ${offer.courses.map((c) => c.name).join(', ')}`,
    );
  }
  if (offer.events?.length) offerHints.push(`events: ${offer.events.join(', ')}`);

  return `<examples>
${examples || '<!-- no examples available -->'}
</examples>

<creator_context>
Niche: ${input.creator.niche}
Audience: ${input.creator.audience}
Transformation promise: ${input.creator.transformation}
Tone: ${input.creator.tone}
Offer hints: ${offerHints.length ? offerHints.join('; ') : '<!-- none -->'}
</creator_context>

<task>
Produce ${TARGET_KEYWORDS} Discovery search keywords for this community. Mix niche / transformation / audience descriptors. Lowercase, 1-4 words each, no duplicates.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

export function parseOutput(raw: string): DiscoverySeoContent {
  const outer = raw.match(/<discovery_seo>([\s\S]*?)<\/discovery_seo>/i);
  if (!outer) throw new Error('discovery_seo: missing <discovery_seo> tag');

  const matches = [
    ...outer[1].matchAll(/<keyword>([\s\S]*?)<\/keyword>/gi),
  ].map((m) => m[1].trim());

  if (matches.length !== TARGET_KEYWORDS) {
    throw new Error(
      `discovery_seo: expected ${TARGET_KEYWORDS} keywords, got ${matches.length}`,
    );
  }

  const seen = new Set<string>();
  for (const [i, kw] of matches.entries()) {
    if (!kw) throw new Error(`discovery_seo: keyword ${i + 1} is empty`);
    if (kw.length > KEYWORD_MAX) {
      throw new Error(
        `discovery_seo: keyword ${i + 1} is ${kw.length} chars (max ${KEYWORD_MAX})`,
      );
    }
    const key = kw.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`discovery_seo: duplicate keyword "${kw}"`);
    }
    seen.add(key);
  }

  return DiscoverySeoContentSchema.parse({ keywords: matches });
}
