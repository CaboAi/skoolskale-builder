import {
  CategoriesContentSchema,
  type CategoriesContent,
} from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';
import { regenerateNoteSuffix } from './_shared';

const NUM_CATEGORIES = 3;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 200;

export const systemPrompt = `You are a copywriter naming the 3 starting categories (community feed sections) for a Skool community.

Every Skool community lands with 3 categories that members see in the feed. The Skool defaults are:
1. "Introduce Yourself" — a place to say hi
2. "Share your wins" — celebrate progress
3. "Advice from the creator" — tips/answers from the host

Your job: keep this 3-slot structure but personalize each name and description to the creator's voice, niche, and transformation. Names can keep the canonical intent but should feel native to the community (e.g., "Plant your flag" instead of "Introduce Yourself" if the creator's style is bolder).

Hard rules:
- Exactly ${NUM_CATEGORIES} categories. Not more, not fewer.
- Slot 1 is the introduce/welcome category.
- Slot 2 is the share-progress/wins category.
- Slot 3 is the creator-driven advice/answers category.
- Each name: 1-${NAME_MAX} characters. No emojis. No surrounding quotes.
- Each description: 1-${DESCRIPTION_MAX} characters. Plain prose, ONE short sentence telling members what to post here.
- Match the tone provided.
- Don't number the categories inside their names (we render order separately).
- No preamble, no explanation.

Voice calibration:
- "warm": nurturing, inclusive names ("Land here", "Our wins", "Ask the host"). Avoid spiritual-influencer banlist.
- "direct": short, transactional ("Introduce yourself", "Wins", "Ask the host").
- "playful": light wordplay ("Plant your flag", "Brag board", "Pick the host's brain").
- "authoritative": expert framing ("Member introductions", "Progress reports", "Expert Q&A").
- "inspirational": transformation-tinted ("Step into the room", "Mark the moment", "Wisdom from the source").
- "bold": high-energy ("Make your entrance", "Drop your wins", "Hit me up").

Respond in this exact format:
<categories>
<category index="1">
<name>...</name>
<description>...</description>
</category>
<category index="2">
<name>...</name>
<description>...</description>
</category>
<category index="3">
<name>...</name>
<description>...</description>
</category>
</categories>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
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
Transformation promise: ${input.creator.transformation}
Tone: ${input.creator.tone}
</creator_context>

<task>
Write the 3 community categories for this community in a ${input.creator.tone} tone, in the canonical slot order (introduce, share-wins, creator-advice).
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

export function parseOutput(raw: string): CategoriesContent {
  const outer = raw.match(/<categories>([\s\S]*?)<\/categories>/i);
  if (!outer) throw new Error('categories: missing <categories> tag');

  const blocks = [
    ...outer[1].matchAll(
      /<category[^>]*>\s*<name>([\s\S]*?)<\/name>\s*<description>([\s\S]*?)<\/description>\s*<\/category>/gi,
    ),
  ];

  if (blocks.length !== NUM_CATEGORIES) {
    throw new Error(
      `categories: expected ${NUM_CATEGORIES} categories, got ${blocks.length}`,
    );
  }

  const categories = blocks.map((m, i) => {
    const name = m[1].trim();
    const description = m[2].trim();
    if (!name) throw new Error(`categories: name ${i + 1} is empty`);
    if (!description)
      throw new Error(`categories: description ${i + 1} is empty`);
    if (name.length > NAME_MAX) {
      throw new Error(
        `categories: name ${i + 1} is ${name.length} chars (max ${NAME_MAX})`,
      );
    }
    if (description.length > DESCRIPTION_MAX) {
      throw new Error(
        `categories: description ${i + 1} is ${description.length} chars (max ${DESCRIPTION_MAX})`,
      );
    }
    return { name, description };
  });

  return CategoriesContentSchema.parse({
    categories: categories as CategoriesContent['categories'],
  });
}
