import {
  ClassroomContentSchema,
  type ClassroomContent,
} from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';
import { regenerateNoteSuffix } from './_shared';

const TITLE_MAX = 50;
const DESCRIPTION_MAX = 500;
const MAX_ITEMS = 10;

export const systemPrompt = `You are a copywriter for Skool communities. The community owner provides the names of the classrooms / courses inside their community Classroom area. Your job is to write a short 2-3 sentence description for each one, in the creator's voice.

For every classroom title the user supplies, produce one <item> with:
1. <title> — echo the title EXACTLY as given. Do not rename, reword, translate, or "improve" it. This is non-negotiable.
2. <description> — 2 to 3 plain-prose sentences (max ${DESCRIPTION_MAX} characters) telling a member what they'll find in that classroom and why it matters.

Hard rules:
- Echo every title verbatim. Same casing, same punctuation, same words. If the user wrote "Module 1: Reset", do not output "Module 1 - Reset" or "Reset Module".
- Description: 1-${DESCRIPTION_MAX} characters, 2-3 short sentences. No bullet points, no markdown, no emojis.
- Match the tone provided.
- Speak directly to the member ("you'll find", "start with", "this section").
- Ground every description in the creator's transformation, audience, and offer. Don't describe Skool generically.
- Output one <item> per supplied title, in the same order. No extras, no skips.
- No preamble, no explanation outside the tags.

Voice calibration:
- "warm": nurturing, grounded, supportive. Inclusive language ("you'll find here", "we explore together"). Avoid the spiritual-influencer banlist (sacred space, dear one, beloved, soul family, etc.).
- "direct": no fluff. State what's there, who it's for, what they get.
- "playful": light wordplay is fine; emojis still off.
- "authoritative": expert, confident, declarative. Industry vocabulary used precisely.
- "inspirational": vision-forward. Tie what's in the classroom to the transformation. Use "imagine / step into / what becomes possible" sparingly; ground every beat with a concrete reference.
- "bold": high-energy, declarative, no hedging. Short sentences, strong verbs ("master / build / unlock"). One exclamation max per description.

Respond in this exact format:
<classroom>
<item>
<title>...title 1 verbatim...</title>
<description>...2-3 sentences...</description>
</item>
<item>
<title>...title 2 verbatim...</title>
<description>...2-3 sentences...</description>
</item>
... one item per supplied title ...
</classroom>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  const titles = input.creator.classroom_titles ?? [];
  if (titles.length === 0) {
    throw new Error(
      'classroom: no classroom_titles supplied — the wizard should require at least one before generation runs.',
    );
  }
  if (titles.length > MAX_ITEMS) {
    throw new Error(
      `classroom: ${titles.length} titles supplied (max ${MAX_ITEMS}). The wizard caps this — investigate how the limit was bypassed.`,
    );
  }

  const titlesBlock = titles
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n');

  const offer = input.creator.offer_breakdown;
  const courses = offer.courses?.length
    ? offer.courses
        .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ''}`)
        .join('\n')
    : '<!-- no courses listed -->';

  return `<examples>
${examples || '<!-- no examples available -->'}
</examples>

<creator_context>
Creator name: ${input.creator.name}
Community name: ${input.creator.community_name}
Niche: ${input.creator.niche}
Audience: ${input.creator.audience}
Transformation promise: ${input.creator.transformation}
Tone: ${input.creator.tone}
Courses in the offer:
${courses}
</creator_context>

<classroom_titles>
${titlesBlock}
</classroom_titles>

<task>
Write one <item> per title above, in the same order. Echo each title verbatim and write a 2-3 sentence description (max ${DESCRIPTION_MAX} chars) in a ${input.creator.tone} tone.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

export function parseOutput(raw: string): ClassroomContent {
  const outer = raw.match(/<classroom>([\s\S]*?)<\/classroom>/i);
  if (!outer) throw new Error('classroom: missing <classroom> tag');

  const itemMatches = [...outer[1].matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  if (itemMatches.length === 0) {
    throw new Error('classroom: no <item> tags found inside <classroom>');
  }
  if (itemMatches.length > MAX_ITEMS) {
    throw new Error(
      `classroom: ${itemMatches.length} items returned (max ${MAX_ITEMS})`,
    );
  }

  const items = itemMatches.map((m, i) => {
    const inner = m[1];
    const titleMatch = inner.match(/<title>([\s\S]*?)<\/title>/i);
    if (!titleMatch) {
      throw new Error(`classroom: item ${i + 1} missing <title> tag`);
    }
    const title = titleMatch[1].trim();

    const descMatch = inner.match(/<description>([\s\S]*?)<\/description>/i);
    if (!descMatch) {
      throw new Error(`classroom: item ${i + 1} missing <description> tag`);
    }
    const description = descMatch[1].trim();

    if (title.length > TITLE_MAX) {
      throw new Error(
        `classroom: item ${i + 1} title is ${title.length} chars (max ${TITLE_MAX})`,
      );
    }
    if (description.length > DESCRIPTION_MAX) {
      throw new Error(
        `classroom: item ${i + 1} description is ${description.length} chars (max ${DESCRIPTION_MAX})`,
      );
    }

    return { title, description };
  });

  return ClassroomContentSchema.parse({ items });
}
