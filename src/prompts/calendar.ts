import {
  CALENDAR_EVENT_DESCRIPTION_MAX,
  CALENDAR_EVENT_TITLE_MAX,
  CALENDAR_MAX_EVENTS,
  CalendarContentSchema,
  type CalendarContent,
  type CalendarEventIntake,
} from '@/types/schemas';
import {
  describeRecurrence,
  formatSchedule,
} from '@/lib/calendar/format-schedule';
import type { GeneratorInput } from '@/types/generators';
import { EmptyIntakeError } from '@/lib/inngest/cap-violation';
import { regenerateNoteSuffix } from './_shared';

const TITLE_MAX = CALENDAR_EVENT_TITLE_MAX;
const DESCRIPTION_MAX = CALENDAR_EVENT_DESCRIPTION_MAX;
const MAX_EVENTS = CALENDAR_MAX_EVENTS;

export const systemPrompt = `You are a copywriter for Skool communities. The community owner provides the names and cadence of the live events on their Calendar. Your job is to write a short 1-2 sentence description for each one, in the creator's voice.

For every event the user supplies, produce one <event> with:
1. <title> — echo the title EXACTLY as given. Do not rename, reword, translate, or "improve" it. This is non-negotiable.
2. <description> — 1 to 2 plain-prose sentences (max ${DESCRIPTION_MAX} characters) telling a member what happens at this event and why it matters to them.

Cadence handling:
- The <cadence> tag tells you whether the event is weekly, monthly, quarterly, yearly, or one-off.
- When the cadence is monthly, quarterly, or yearly, the cadence itself IS part of the event's value (e.g. a monthly Full Moon Ceremony, a quarterly QBR Detox). Referencing it naturally in the description is welcome — "Each month we gather to...", "Every quarter we reset...", "Once a year we...".
- For weekly events, the cadence is already obvious from context — DON'T restate "every Monday" in the description, that's wasted budget.
- For one-off events, the description should reflect the singular nature without restating the date.

Hard rules:
- Echo every title verbatim. Same casing, same punctuation, same words.
- Description: 1-${DESCRIPTION_MAX} characters, 1-2 short sentences. No bullet points, no markdown, no emojis.
- Match the tone provided.
- Speak directly to the member ("you'll join", "we work through", "drop in for").
- Ground every description in the creator's transformation, audience, and offer. Don't describe Skool generically.
- Output one <event> per supplied event, in the same order. No extras, no skips.
- No preamble, no explanation outside the tags.

Voice calibration:
- "warm": nurturing, inclusive ("we gather", "join us"). Avoid spiritual-influencer banlist.
- "direct": state what happens, who it's for, what they leave with.
- "playful": light wordplay; emojis off.
- "authoritative": expert framing, declarative.
- "inspirational": tie the event to the transformation when natural.
- "bold": high-energy, short, punchy. Strong verbs.

Respond in this exact format:
<calendar>
<event>
<title>...title 1 verbatim...</title>
<description>...1-2 sentences...</description>
</event>
<event>
<title>...title 2 verbatim...</title>
<description>...1-2 sentences...</description>
</event>
... one event per supplied event ...
</calendar>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  const events: CalendarEventIntake[] = input.creator.calendar_intake?.events ?? [];
  if (events.length === 0) {
    // Skip gracefully — the runner catches this typed error and writes
    // an empty calendar asset rather than failing the whole module.
    // The wizard normally seeds at least one event row, but creators
    // created via API or drafts loaded from earlier state can land here.
    throw new EmptyIntakeError({
      module: 'calendar',
      moduleLabel: 'Calendar',
      emptyContent: { events: [] },
    });
  }
  if (events.length > MAX_EVENTS) {
    throw new Error(
      `calendar: ${events.length} events supplied (max ${MAX_EVENTS}). The wizard caps this — investigate how the limit was bypassed.`,
    );
  }

  const eventsBlock = events
    .map((e, i) => {
      // Surface cadence + full-schedule on every event so Claude can pick
      // up the rhythm in monthly/yearly cases without us hand-tuning each
      // recurrence branch in prose. <cadence> is the cadence-only phrase
      // (e.g. "The 15th of every month"); <schedule> is cadence + time +
      // tz for context.
      return `${i + 1}. ${e.title}
   <cadence>${describeRecurrence(e.schedule)}</cadence>
   <schedule>${formatSchedule(e.schedule)}</schedule>`;
    })
    .join('\n');

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

<events>
${eventsBlock}
</events>

<task>
Write one <event> per event above, in the same order. Echo each title verbatim and write a 1-2 sentence description (max ${DESCRIPTION_MAX} chars) in a ${input.creator.tone} tone. Do not restate the cadence/time inside the description.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

export function parseOutput(
  raw: string,
  input?: GeneratorInput,
): CalendarContent {
  const outer = raw.match(/<calendar>([\s\S]*?)<\/calendar>/i);
  if (!outer) throw new Error('calendar: missing <calendar> tag');

  const eventMatches = [...outer[1].matchAll(/<event>([\s\S]*?)<\/event>/gi)];
  if (eventMatches.length === 0) {
    throw new Error('calendar: no <event> tags found inside <calendar>');
  }
  if (eventMatches.length > MAX_EVENTS) {
    throw new Error(
      `calendar: ${eventMatches.length} events returned (max ${MAX_EVENTS})`,
    );
  }

  const intakeEvents: CalendarEventIntake[] =
    input?.creator.calendar_intake?.events ?? [];

  const events = eventMatches.map((m, i) => {
    const inner = m[1];
    const titleMatch = inner.match(/<title>([\s\S]*?)<\/title>/i);
    if (!titleMatch) {
      throw new Error(`calendar: event ${i + 1} missing <title> tag`);
    }
    const title = titleMatch[1].trim();

    const descMatch = inner.match(/<description>([\s\S]*?)<\/description>/i);
    if (!descMatch) {
      throw new Error(`calendar: event ${i + 1} missing <description> tag`);
    }
    const description = descMatch[1].trim();

    if (title.length > TITLE_MAX) {
      throw new Error(
        `calendar: event ${i + 1} title is ${title.length} chars (max ${TITLE_MAX})`,
      );
    }
    if (description.length > DESCRIPTION_MAX) {
      throw new Error(
        `calendar: event ${i + 1} description is ${description.length} chars (max ${DESCRIPTION_MAX})`,
      );
    }

    // Pair the parsed description with the originating intake event's schedule
    // by index. If intake wasn't passed (legacy callers, parser tests), fall
    // back to a placeholder schedule that satisfies the schema — runtime
    // callers via _shared.ts always pass intake so descriptions stick to the
    // right schedule slot.
    const intakeEvent = intakeEvents[i];
    const schedule = intakeEvent?.schedule ?? {
      type: 'weekly' as const,
      dayOfWeek: 'mon' as const,
      time: '00:00',
      timezone: 'UTC',
    };

    return { title, description, schedule };
  });

  return CalendarContentSchema.parse({ events });
}
