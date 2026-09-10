import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';
import { CapViolationError } from '@/lib/inngest/cap-violation';
import { regenerateNoteSuffix } from './_shared';

/**
 * The pinned welcome post on the community's main feed. Every new member
 * sees it as their first content from the creator. Structure modeled on
 * Ramsha's Story Medicine Writers post (~1,733 chars):
 *
 *   1. Title — "Welcome to <Community> <1-2 emojis>"
 *   2. Warm opener line
 *   3. Gratitude + community framing
 *   4. PLEASE READ callout (🛑)
 *   5. 4-5 action items (👉 + headline + 2-4 sub-bullets):
 *      a. Introduce yourself in the <intro category> category
 *      b. Engage with 2 posts
 *      c. Explore the Classroom
 *      d. Add events to your calendar  (CONDITIONAL on intake)
 *      e. Download the Skool mobile app
 *   6. Closing emotional line
 *
 * Two firsts in this module:
 *   - Structured `{ title, body }` output (every other text module is a
 *     single blob).
 *   - Cross-module dependency: the intro-category name is read from the
 *     generated `categories` asset, not from intake. See
 *     `src/lib/inngest/functions/generate-first-post.ts` for the
 *     polling-with-backoff resolver.
 *
 * No merge tags. Pinned posts are static community content — the
 * community name is baked in as a literal string at generation time.
 */

export const FIRST_POST_TITLE_MAX = 100;
export const FIRST_POST_BODY_TARGET = 1800;
export const FIRST_POST_BODY_MAX = 2500;

export const FirstPostSchema = z.object({
  title: z.string().min(1).max(FIRST_POST_TITLE_MAX),
  body: z.string().min(1).max(FIRST_POST_BODY_MAX),
});

export type FirstPostOutput = z.infer<typeof FirstPostSchema>;

/** Default intro-category name when the generated categories asset is
 *  missing, corrupted, or none of the names contain "intro". */
export const FALLBACK_INTRO_CATEGORY = 'Introduce Yourself';

export const systemPrompt = `You are a copywriter ghost-writing the pinned welcome post on a Skool community's main feed. Every new member sees this post on day one as their first content from the creator. It sets the tone for the whole community.

The output is a structured JSON object with two fields:
- title: short "Welcome to <Community Name> <1-2 emojis fitting the niche>" line, max ${FIRST_POST_TITLE_MAX} chars.
- body: the full post text, ${FIRST_POST_BODY_TARGET}-${FIRST_POST_BODY_MAX} chars. Plain text + emojis only — no markdown, no HTML.

The body MUST follow this 6-part skeleton, in order:

  1. Warm opener line (1 line). Sets the emotional register. Voice matches the creator's tone.
  2. Gratitude + community framing (1-2 lines). Why this space exists, why members are here.
  3. 🛑 PLEASE READ callout (1 line, lead with 🛑 or another attention emoji). Signals the action block that follows.
  4. Action items block — between 4 and 5 items. Each item is:
       👉 <Action headline using a clear verb>
       <2-4 short sub-bullet lines explaining the action, one per line>
     The action items in this exact order, omitting any flagged 'omit':
       (a) Introduce yourself — say hi in the "<INTRO_CATEGORY>" category. (Use the category name passed in literally.)
       (b) Engage with at least 2 posts. (The "2" is intentional and hardcoded.)
       (c) Explore the Classroom.
       (d) Add the community events to your calendar.  <CONDITIONAL — included only when the community has events>
       (e) Download the Skool mobile app.
  5. Closing emotional line (1 line). Returns to the warmth of the opener. Sign-off in the creator's voice (e.g., "With love, <Creator>" / "See you inside — <Creator>").

Hard rules:
- DO NOT use merge tags (no #NAME#, no #GROUPNAME#). The community name is a LITERAL STRING baked into the title + body at generation time.
- Body length: ${FIRST_POST_BODY_TARGET}-${FIRST_POST_BODY_MAX} characters. Count before outputting. Rewrite tighter if over the cap.
- Title length: 1-${FIRST_POST_TITLE_MAX} characters.
- Voice driven by tone — same calibration table as other text modules:
    "warm": nurturing, inclusive, grounded ("you'll find / we / together").
    "direct": no fluff. State each beat, point to the next.
    "playful": light wordplay, casual register.
    "authoritative": expert framing, declarative.
    "inspirational": vision-forward, tied to the transformation.
    "bold": high-energy, short punchy sentences, strong verbs.
- For "warm" + spiritual niches: avoid the spiritual-influencer banlist ("sacred space", "beloved", "soul family", "divine timing").
- Output valid JSON inside <first_post_json>...</first_post_json> tags. No preamble outside.

Respond in this exact format:
<first_post_json>
{ "title": "...", "body": "..." }
</first_post_json>`;

export type FirstPostUserMessageInput = {
  input: GeneratorInput;
  /** Intro-category name resolved from the generated categories asset. */
  introCategoryName: string;
  /** Whether the community has calendar events (drives the conditional action item). */
  hasCalendarEvents: boolean;
};

export function buildUserMessage({
  input,
  introCategoryName,
  hasCalendarEvents,
}: FirstPostUserMessageInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  const calendarActionLine = hasCalendarEvents
    ? 'INCLUDE the "Add the community events to your calendar" action item (the community DOES have events).'
    : 'OMIT the "Add the community events to your calendar" action item (the community has NO scheduled events).';

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

<cross_module>
Intro category name (literal string for the "Introduce yourself" action item):
  INTRO_CATEGORY = "${introCategoryName}"
</cross_module>

<calendar_intent>
${calendarActionLine}
</calendar_intent>

<task>
Write the pinned welcome post for "${input.creator.community_name}" in a ${input.creator.tone} tone. Title + body in JSON. ${FIRST_POST_BODY_TARGET}-${FIRST_POST_BODY_MAX} chars on the body. Reference the INTRO_CATEGORY by name. Use the community name as a literal string — no merge tags.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

/**
 * Parse the Claude response into a FirstPostOutput.
 *
 * Two paths:
 *   - Happy path: parse the JSON inside <first_post_json> tags.
 *   - Fallback: if the tags are missing or the JSON parse fails, split
 *     the raw response on the first newline — first line is title,
 *     remainder is body. This is the recovery the brief asked for.
 *
 * Body over cap → CapViolationError so the runner can fire its single
 * rewrite-tighter retry (same machinery as Welcome DM + About Us).
 */
export function parseOutput(raw: string): FirstPostOutput {
  const data = extractFirstPostShape(raw);
  if (data.body.length > FIRST_POST_BODY_MAX) {
    throw new CapViolationError({
      module: 'first_post',
      moduleLabel: 'First Post',
      actualChars: data.body.length,
      maxChars: FIRST_POST_BODY_MAX,
      rawOutput: raw,
    });
  }
  // Final structural pass — title.max(100), body.max(2500), non-empty
  // on both. The cap check above ensures we throw the typed retry-able
  // error on body overshoot before we'd hit this schema rejection.
  return FirstPostSchema.parse(data);
}

function extractFirstPostShape(raw: string): { title: string; body: string } {
  const match = raw.match(/<first_post_json>([\s\S]*?)<\/first_post_json>/i);
  if (match) {
    const jsonText = match[1].trim();
    try {
      const data = JSON.parse(jsonText) as Partial<FirstPostOutput>;
      if (typeof data.title === 'string' && typeof data.body === 'string') {
        return { title: data.title.trim(), body: data.body.trim() };
      }
    } catch {
      // fall through to split-on-newline recovery
    }
  }
  // Recovery path — first line = title, remainder = body. Model
  // occasionally drops the JSON wrapper under load; we'd rather salvage
  // than fail.
  const trimmed = raw.trim();
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1 || firstNewline === trimmed.length - 1) {
    throw new Error('first_post: no <first_post_json> tag and no newline to split on');
  }
  const title = trimmed.slice(0, firstNewline).trim();
  const body = trimmed.slice(firstNewline + 1).trim();
  if (!title || !body) {
    throw new Error('first_post: recovery split produced empty title or body');
  }
  return { title, body };
}
