import { ClassroomContentSchema, type ClassroomContent } from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';

const TITLE_MAX = 50;
const DESCRIPTION_MAX = 500;

export const systemPrompt = `You are a copywriter for Skool communities. You name and describe the community Classroom area — the place where members find courses, modules, and onboarding content.

Your job is to produce TWO outputs:
1. A short Classroom title (max ${TITLE_MAX} characters).
2. A description (max ${DESCRIPTION_MAX} characters) that tells a new member what they'll find in the Classroom and why it matters.

Hard rules:
- Title: 1-${TITLE_MAX} characters. No emojis. No surrounding quotes.
- Description: 1-${DESCRIPTION_MAX} characters. Plain prose, 2-4 short sentences. No bullet points, no markdown.
- Match the tone provided.
- Speak directly to the member ("you'll find", "start with").
- Reference the creator's transformation/offer concretely; don't describe Skool generically.
- No preamble, no explanation outside the tags.

Voice calibration:
- For "warm" tone: nurturing, grounded, supportive. Inclusive language ("you'll find here", "we explore together"). Avoid the spiritual-influencer banlist (sacred space, dear one, beloved, soul family, etc.) — comforting reads as more authentic than effusive.
- For "direct" tone: no fluff. State what's there, who it's for, what they get.
- For "playful" tone: light wordplay is fine; emojis still off.
- For "authoritative" tone: expert, confident, declarative. Industry vocabulary used precisely. Frame the Classroom as the structured curriculum it is — "this is where", not "you'll discover".
- For "inspirational" tone: vision-forward. Tie what's in the Classroom to the transformation. Use "imagine / step into / what becomes possible" sparingly; ground every beat with a concrete reference.
- For "bold" tone: high-energy, declarative, no hedging. Short sentences, strong verbs ("master / build / unlock"). One exclamation max.

Respond in this exact format:
<classroom>
<title>...the title...</title>
<description>...the description...</description>
</classroom>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  const offer = input.creator.offer_breakdown;
  const courses = offer.courses?.length
    ? offer.courses.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n')
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
${input.regenerateNote ? `\n<regenerate_note>${input.regenerateNote}</regenerate_note>\n` : ''}
<task>
Write a Classroom title (max ${TITLE_MAX} chars) and description (max ${DESCRIPTION_MAX} chars) for this community in a ${input.creator.tone} tone.
</task>`;
}

export function parseOutput(raw: string): ClassroomContent {
  const outer = raw.match(/<classroom>([\s\S]*?)<\/classroom>/i);
  if (!outer) throw new Error('classroom: missing <classroom> tag');

  const titleMatch = outer[1].match(/<title>([\s\S]*?)<\/title>/i);
  if (!titleMatch) throw new Error('classroom: missing <title> tag');
  const title = titleMatch[1].trim();

  const descMatch = outer[1].match(/<description>([\s\S]*?)<\/description>/i);
  if (!descMatch) throw new Error('classroom: missing <description> tag');
  const description = descMatch[1].trim();

  if (title.length > TITLE_MAX) {
    throw new Error(
      `classroom: title is ${title.length} chars (max ${TITLE_MAX})`,
    );
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new Error(
      `classroom: description is ${description.length} chars (max ${DESCRIPTION_MAX})`,
    );
  }

  return ClassroomContentSchema.parse({ title, description });
}
