import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';
import { regenerateNoteSuffix } from './_shared';
import { CapViolationError } from '@/lib/inngest/cap-violation';

/**
 * Skool caps the welcome DM at 300 rendered characters. The merge tags
 * #NAME# and #GROUPNAME# expand at send time — worst-case net expansion
 * is ~25 chars — so we generate under 275 to guarantee the rendered
 * message stays under the hard 300-char cap.
 */
export const WELCOME_DM_MAX_CHARS = 275;
export const WELCOME_DM_TARGET_MIN = 220;

export const WelcomeDmSchema = z.object({
  content: z
    .string()
    .min(50)
    .refine((text) => text.length <= WELCOME_DM_MAX_CHARS, {
      message: `Welcome DM exceeds Skool's ${WELCOME_DM_MAX_CHARS}-char cap`,
    }),
});

export type WelcomeDmOutput = z.infer<typeof WelcomeDmSchema>;

export const systemPrompt = `You are a specialist copywriter for Skool communities, trained on Skool Skale's voice and tone.

Your job is to write Welcome DMs that new community members receive immediately after joining. These DMs:
- Address the member by name using the #NAME# merge tag
- Name the community using the #GROUPNAME# merge tag
- Direct the member to Classroom > Start Here
- Match the creator's chosen tone exactly

Hard length constraint (NON-NEGOTIABLE):
- Output must be ${WELCOME_DM_TARGET_MIN}-${WELCOME_DM_MAX_CHARS} characters INCLUDING the merge tags #NAME# and #GROUPNAME# as written. Do not expand them.
- Count characters before outputting. If over ${WELCOME_DM_MAX_CHARS} or under ${WELCOME_DM_TARGET_MIN}, rewrite tighter.
- Skool's hard cap is 300 chars rendered (after #NAME# and #GROUPNAME# expand at send time). We're staying under ${WELCOME_DM_MAX_CHARS} to keep a safe buffer.

Required structure (in this order, nothing else):
1. Greeting that uses #NAME#.
2. One short line welcoming them to #GROUPNAME#.
3. ONE concrete next step. Default: tell them to open Classroom > Start Here.
4. Brief sign-off.

That is the whole DM. There is no room for a support contact mention, no room for multiple next-step suggestions, no room for warmth padding.

Merge-tag rules:
- Every DM MUST contain both "#NAME#" and "#GROUPNAME#" verbatim.
- No other merge tags.
- Output only the DM text inside the <welcome_dm> tags. No preamble, no commentary.

Banned (regardless of tone):
- Transformation language ("step into your power", "what becomes possible", "your journey").
- Spiritual-influencer register: "beloved", "sacred", "with love and light", "dear one", "soul family", "you are seen".
- Generic warmth padding ("so excited", "we're thrilled", "you're going to love it here") — burns characters with no information.
- Multiple next-step suggestions. ONE step. Classroom > Start Here is the default.
- Support contact (no character budget for it).

Per-tone calibration — applies to the 4-beat structure above, NOT to length (length is fixed):
- "warm": grounded, inclusive. "you'll find / we / together / here for you" register, never spiritual.
- "direct": no preamble, no padding. Greet, point, sign off.
- "playful": one light beat is fine. Emojis allowed but max one.
- "authoritative": confident, declarative. State the next step as a fact, not an invitation.
- "inspirational": forward-leaning but concrete — connect the welcome to one specific outcome, no generic motivation.
- "bold": short punchy sentences, strong verbs, max one exclamation point.

Respond in this exact format:
<welcome_dm>
...the DM text — ${WELCOME_DM_TARGET_MIN}-${WELCOME_DM_MAX_CHARS} chars INCLUDING #NAME# and #GROUPNAME# literals...
</welcome_dm>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} tone="${ex.tone ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  return `<examples>
${examples || '<!-- no examples available; rely on the system prompt -->'}
</examples>

<creator_context>
Creator name: ${input.creator.name}
Community name: ${input.creator.community_name}
Tone: ${input.creator.tone}
Niche: ${input.creator.niche}
</creator_context>

<task>
Write a Welcome DM in a ${input.creator.tone} tone. ${WELCOME_DM_TARGET_MIN}-${WELCOME_DM_MAX_CHARS} characters total (counting #NAME# and #GROUPNAME# as written). Greeting → welcome → Classroom > Start Here → sign-off. Nothing else.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

/**
 * Parse the Welcome DM out of a Claude response.
 *
 * Throws `CapViolationError` when content is over the hard cap so the
 * generator factory can fire its single auto-retry with a "rewrite
 * tighter" follow-up. Other validation failures (missing tags, missing
 * merge tags, empty body) throw plain errors — Inngest's normal retry
 * machinery handles those.
 */
export function parseOutput(raw: string): WelcomeDmOutput {
  const match = raw.match(/<welcome_dm>([\s\S]*?)<\/welcome_dm>/i);
  if (!match) throw new Error('welcome_dm: missing <welcome_dm> tag');

  const content = match[1].trim();
  if (!content) throw new Error('welcome_dm: empty content');

  if (!content.includes('#NAME#')) {
    throw new Error('welcome_dm: missing #NAME# merge tag');
  }
  if (!content.includes('#GROUPNAME#')) {
    throw new Error('welcome_dm: missing #GROUPNAME# merge tag');
  }
  const stray = content.match(/#[A-Z_]+#/g)?.filter(
    (t) => t !== '#NAME#' && t !== '#GROUPNAME#',
  );
  if (stray && stray.length > 0) {
    throw new Error(`welcome_dm: unexpected merge tags ${stray.join(', ')}`);
  }

  // Cap check happens BEFORE schema.parse so the factory can catch the
  // typed CapViolationError and trigger one retry. The .refine() in
  // WelcomeDmSchema is defense-in-depth for direct schema parses (e.g.
  // edit-form submissions).
  if (content.length > WELCOME_DM_MAX_CHARS) {
    throw new CapViolationError({
      module: 'welcome_dm',
      moduleLabel: 'Welcome DM',
      actualChars: content.length,
      maxChars: WELCOME_DM_MAX_CHARS,
      rawOutput: raw,
    });
  }

  return WelcomeDmSchema.parse({ content });
}
