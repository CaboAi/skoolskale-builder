import { CalendarContentSchema, type CalendarContent } from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';

const TITLE_MAX = 30;
const DESCRIPTION_MAX = 300;

export const systemPrompt = `You are a copywriter for Skool communities. You name and describe the community Calendar — the place where live events, calls, and recurring sessions live.

Your job is to produce TWO outputs:
1. A short Calendar title (max ${TITLE_MAX} characters).
2. A description (max ${DESCRIPTION_MAX} characters) that tells a member what to expect on the calendar and how often things happen.

Hard rules:
- Title: 1-${TITLE_MAX} characters. No emojis. No surrounding quotes.
- Description: 1-${DESCRIPTION_MAX} characters. Plain prose, 1-3 short sentences.
- Match the tone provided.
- Reference real cadence/format if the creator's offer mentions live calls, events, or recurring sessions. If none mentioned, focus on what members can expect when events DO happen.
- No preamble, no explanation outside the tags.

Voice calibration:
- "warm": nurturing, inclusive — "we gather / together / here for". Avoid spiritual-influencer banlist.
- "direct": state cadence + format, nothing else.
- "playful": light wordplay; emojis off.
- "authoritative": expert, declarative. Frame the calendar as the structured rhythm it is.
- "inspirational": tie the cadence to the transformation when natural.
- "bold": high-energy, declarative. Short, punchy. Strong verbs.

Respond in this exact format:
<calendar>
<title>...the title...</title>
<description>...the description...</description>
</calendar>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  const offer = input.creator.offer_breakdown;
  const liveCalls = offer.live_calls ?? '<!-- not specified -->';
  const events = offer.events?.length ? offer.events.join(', ') : '<!-- none -->';

  return `<examples>
${examples || '<!-- no examples available -->'}
</examples>

<creator_context>
Creator name: ${input.creator.name}
Community name: ${input.creator.community_name}
Niche: ${input.creator.niche}
Audience: ${input.creator.audience}
Tone: ${input.creator.tone}
Live calls cadence: ${liveCalls}
Events: ${events}
</creator_context>
${input.regenerateNote ? `\n<regenerate_note>${input.regenerateNote}</regenerate_note>\n` : ''}
<task>
Write a Calendar title (max ${TITLE_MAX} chars) and description (max ${DESCRIPTION_MAX} chars) for this community in a ${input.creator.tone} tone.
</task>`;
}

export function parseOutput(raw: string): CalendarContent {
  const outer = raw.match(/<calendar>([\s\S]*?)<\/calendar>/i);
  if (!outer) throw new Error('calendar: missing <calendar> tag');

  const titleMatch = outer[1].match(/<title>([\s\S]*?)<\/title>/i);
  if (!titleMatch) throw new Error('calendar: missing <title> tag');
  const title = titleMatch[1].trim();

  const descMatch = outer[1].match(/<description>([\s\S]*?)<\/description>/i);
  if (!descMatch) throw new Error('calendar: missing <description> tag');
  const description = descMatch[1].trim();

  if (title.length > TITLE_MAX) {
    throw new Error(
      `calendar: title is ${title.length} chars (max ${TITLE_MAX})`,
    );
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new Error(
      `calendar: description is ${description.length} chars (max ${DESCRIPTION_MAX})`,
    );
  }

  return CalendarContentSchema.parse({ title, description });
}
