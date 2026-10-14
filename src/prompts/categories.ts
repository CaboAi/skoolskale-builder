import {
  CategoriesContentSchema,
  type CategoriesContent,
} from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';
import { listedPerks, regenerateNoteSuffix } from './_shared';

const BASE_CATEGORIES = 3;
const WITH_PERKS_CATEGORIES = 4;
const NAME_MAX = 60;

/** Index of the perks category in the generated list, when present. */
export const PERKS_CATEGORY_INDEX = 3;

export const systemPrompt = `You are a copywriter naming the starting categories (community feed sections) for a Skool community.

Every Skool community lands with 3 categories that members see in the feed. The Skool defaults are:
1. "Introduce Yourself" — a place to say hi
2. "Share your wins" — celebrate progress
3. "Advice from the creator" — tips/answers from the host

When the creator offers member perks, a 4th category is added:
4. "Perks" — where the creator posts the member perks and how to use them

Your job: keep this slot structure but personalize each name to the creator's voice, niche, and transformation. Names can keep the canonical intent but should feel native to the community (e.g., "Plant your flag" instead of "Introduce Yourself" if the creator's style is bolder).

Hard rules:
- Exactly ${BASE_CATEGORIES} categories, or exactly ${WITH_PERKS_CATEGORIES} when the task says the creator has perks. Not more, not fewer.
- Slot 1 is the introduce/welcome category.
- Slot 2 is the share-progress/wins category.
- Slot 3 is the creator-driven advice/answers category.
- Slot 4 (perks only) is the member-perks category. Its name must still read clearly as perks/benefits/bonuses.
- Each name: 1-${NAME_MAX} characters. No emojis. No surrounding quotes.
- Match the tone provided.
- Don't number the categories inside their names (we render order separately).
- Do NOT output descriptions — Skool's category UI is name-only.
- No preamble, no explanation.

Voice calibration:
- "warm": nurturing, inclusive names ("Land here", "Our wins", "Ask the host", "Member gifts"). Avoid spiritual-influencer banlist.
- "direct": short, transactional ("Introduce yourself", "Wins", "Ask the host", "Perks").
- "playful": light wordplay ("Plant your flag", "Brag board", "Pick the host's brain", "Goodie bag").
- "authoritative": expert framing ("Member introductions", "Progress reports", "Expert Q&A", "Member benefits").
- "inspirational": transformation-tinted ("Step into the room", "Mark the moment", "Wisdom from the source", "Gifts for the journey").
- "bold": high-energy ("Make your entrance", "Drop your wins", "Hit me up", "Member perks").

Respond in this exact format (add a <category index="4"> block only when the creator has perks):
<categories>
<category index="1">
<name>...</name>
</category>
<category index="2">
<name>...</name>
</category>
<category index="3">
<name>...</name>
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

  const perks = listedPerks(input.creator.offer_breakdown);
  const slotInstruction =
    perks.length > 0
      ? `The creator HAS perks (${perks.join('; ')}). Write ${WITH_PERKS_CATEGORIES} category names in the canonical slot order (introduce, share-wins, creator-advice, perks).`
      : `The creator has NO perks. Write ${BASE_CATEGORIES} category names in the canonical slot order (introduce, share-wins, creator-advice).`;

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
${slotInstruction} Use a ${input.creator.tone} tone. Output names only — no descriptions.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

/**
 * The count is checked against the intake when it's available: a perks
 * creator must get the 4th slot and a no-perks creator must not. Without
 * the input (prompt-editor path) either 3 or 4 names is accepted.
 */
export function parseOutput(
  raw: string,
  input?: GeneratorInput,
): CategoriesContent {
  const outer = raw.match(/<categories>([\s\S]*?)<\/categories>/i);
  if (!outer) throw new Error('categories: missing <categories> tag');

  const blocks = [
    ...outer[1].matchAll(
      /<category[^>]*>\s*<name>([\s\S]*?)<\/name>\s*<\/category>/gi,
    ),
  ];

  const allowed = input
    ? [
        listedPerks(input.creator.offer_breakdown).length > 0
          ? WITH_PERKS_CATEGORIES
          : BASE_CATEGORIES,
      ]
    : [BASE_CATEGORIES, WITH_PERKS_CATEGORIES];
  if (!allowed.includes(blocks.length)) {
    throw new Error(
      `categories: expected ${allowed.join(' or ')} categories, got ${blocks.length}`,
    );
  }

  const names = blocks.map((m, i) => {
    const name = m[1].trim();
    if (!name) throw new Error(`categories: name ${i + 1} is empty`);
    if (name.length > NAME_MAX) {
      throw new Error(
        `categories: name ${i + 1} is ${name.length} chars (max ${NAME_MAX})`,
      );
    }
    return name;
  });

  return CategoriesContentSchema.parse({ categories: names });
}
