import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';
import {
  CapViolationError,
  EmptyIntakeError,
} from '@/lib/inngest/cap-violation';
import { listedPerks, regenerateNoteSuffix } from './_shared';

/**
 * The second launch post: announces the member perks the creator listed on
 * intake step 2. It's published in the perks category (slot 4 of the
 * generated categories), alongside the pinned welcome post.
 *
 * Creators with no perks get an empty `{ title: '', body: '' }` asset via
 * EmptyIntakeError — same skip path classroom + calendar use — so the card
 * still lands and can be approved without a Claude call.
 */

export const PERKS_POST_TITLE_MAX = 100;
export const PERKS_POST_BODY_TARGET = 1200;
export const PERKS_POST_BODY_MAX = 2000;

export const PerksPostSchema = z
  .object({
    title: z.string().max(PERKS_POST_TITLE_MAX),
    body: z.string().max(PERKS_POST_BODY_MAX),
  })
  .refine((p) => (p.title === '') === (p.body === ''), {
    message: 'Title and body must both be filled in (or both empty when the creator has no perks).',
  });

export type PerksPostOutput = z.infer<typeof PerksPostSchema>;

export const EMPTY_PERKS_POST: PerksPostOutput = { title: '', body: '' };

export const systemPrompt = `You are a copywriter ghost-writing the "member perks" post on a Skool community's feed. It is one of the first posts members see, published in the community's perks category right after the pinned welcome post. Its job: make members aware of every perk they get and excited to use them.

The output is a structured JSON object with two fields:
- title: short, inviting line naming the perks + 1-2 emojis fitting the niche, max ${PERKS_POST_TITLE_MAX} chars.
- body: the full post text, around ${PERKS_POST_BODY_TARGET} chars, never over ${PERKS_POST_BODY_MAX}. Plain text + emojis only — no markdown, no HTML.

The body MUST follow this skeleton, in order:

  1. Hook line (1 line). Voice matches the creator's tone.
  2. Why these perks exist (1-2 lines). Tie them to the member's transformation.
  3. Perks block — one item per perk the creator listed, in the given order. Each item is:
       <one fitting emoji> <Perk name>
       <1-2 short lines on what the member gets and why it helps>
  4. How to use them (1-2 lines). If a perk obviously needs a link, code, or booking step the creator hasn't supplied, write a clearly marked placeholder like [[link to claim]] instead of inventing one.
  5. Engagement prompt (1 line): ask members to comment which perk they'll use first.
  6. Sign-off in the creator's voice (e.g., "See you inside — <Creator>").

Hard rules:
- Cover EVERY listed perk and ONLY the listed perks. Never invent perks, discounts, prices, dollar values, partner names, or redemption mechanics.
- DO NOT use merge tags (no #NAME#, no #GROUPNAME#). The community name is a LITERAL STRING.
- Body length: aim for ${PERKS_POST_BODY_TARGET} characters, hard max ${PERKS_POST_BODY_MAX}. Count before outputting. Rewrite tighter if over the cap.
- Voice driven by tone:
    "warm": nurturing, inclusive, grounded ("you'll find / we / together").
    "direct": no fluff. Name each perk, say what it does.
    "playful": light wordplay, casual register.
    "authoritative": expert framing, declarative.
    "inspirational": vision-forward, tied to the transformation.
    "bold": high-energy, short punchy sentences, strong verbs.
- For "warm" + spiritual niches: avoid the spiritual-influencer banlist ("sacred space", "beloved", "soul family", "divine timing").
- Output valid JSON inside <perks_post_json>...</perks_post_json> tags. No preamble outside.

Respond in this exact format:
<perks_post_json>
{ "title": "...", "body": "..." }
</perks_post_json>`;

export function buildUserMessage(input: GeneratorInput): string {
  const perks = listedPerks(input.creator.offer_breakdown);
  if (perks.length === 0) {
    throw new EmptyIntakeError({
      module: 'perks_post',
      moduleLabel: 'Perks Post',
      emptyContent: EMPTY_PERKS_POST,
    });
  }

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
Transformation: ${input.creator.transformation}
Tone: ${input.creator.tone}
Brand prefs: ${input.creator.brand_prefs || '(none)'}
</creator_context>

<perks>
${perks.map((p, i) => `${i + 1}. ${p}`).join('\n')}
</perks>

<task>
Write the member perks post for "${input.creator.community_name}" in a ${input.creator.tone} tone. Title + body in JSON. Cover all ${perks.length} perks above, in order. Body around ${PERKS_POST_BODY_TARGET} chars, never over ${PERKS_POST_BODY_MAX}.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

/**
 * Body over cap → CapViolationError so the runner fires its single
 * rewrite-tighter retry (same machinery as First Post).
 */
export function parseOutput(raw: string): PerksPostOutput {
  const match = raw.match(/<perks_post_json>([\s\S]*?)<\/perks_post_json>/i);
  if (!match) throw new Error('perks_post: missing <perks_post_json> tag');

  let data: unknown;
  try {
    data = JSON.parse(match[1].trim());
  } catch (e) {
    throw new Error(
      `perks_post: invalid JSON — ${e instanceof Error ? e.message : 'parse error'}`,
    );
  }

  const { title, body } = (data ?? {}) as Partial<PerksPostOutput>;
  if (typeof title !== 'string' || typeof body !== 'string') {
    throw new Error('perks_post: JSON must have string title and body');
  }
  const post = { title: title.trim(), body: body.trim() };
  if (!post.title || !post.body) {
    throw new Error('perks_post: title and body must be non-empty');
  }
  if (post.body.length > PERKS_POST_BODY_MAX) {
    throw new CapViolationError({
      module: 'perks_post',
      moduleLabel: 'Perks Post',
      actualChars: post.body.length,
      maxChars: PERKS_POST_BODY_MAX,
      rawOutput: raw,
    });
  }
  return PerksPostSchema.parse(post);
}
