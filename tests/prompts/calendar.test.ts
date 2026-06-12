import { describe, expect, test } from 'vitest';
import { buildUserMessage, parseOutput } from '@/prompts/calendar';
import type { EventSchedule } from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';

const WEEKLY: EventSchedule = {
  type: 'weekly',
  dayOfWeek: 'mon',
  interval: 1,
  time: '09:00',
  timezone: 'America/New_York',
};

const BIWEEKLY: EventSchedule = {
  type: 'weekly',
  dayOfWeek: 'sun',
  interval: 2,
  time: '09:00',
  timezone: 'America/New_York',
};

const ONE_OFF: EventSchedule = {
  type: 'one_off',
  date: '2026-08-08',
  time: '11:00',
  timezone: 'America/Los_Angeles',
};

const MONTHLY: EventSchedule = {
  type: 'monthly',
  dayOfMonth: 15,
  interval: 1,
  time: '20:00',
  timezone: 'America/New_York',
};

const QUARTERLY: EventSchedule = {
  type: 'monthly',
  dayOfMonth: 1,
  interval: 3,
  time: '09:00',
  timezone: 'America/New_York',
};

const YEARLY: EventSchedule = {
  type: 'yearly',
  month: 5,
  dayOfMonth: 8,
  time: '09:00',
  timezone: 'America/New_York',
};

function buildInput(
  events: { title: string; schedule: EventSchedule }[],
): GeneratorInput {
  return {
    creator: {
      name: 'X',
      community_name: 'Y',
      niche: 'other',
      audience: 'a',
      transformation: 't',
      tone: 'direct',
      offer_breakdown: {
        perks: [],
        guest_sessions: false,
      },
      pricing: { additional_tiers: [] },
      trial_terms: { has_trial: false, duration_days: 7 as const },
      refund_policy: '',
      support_contact: 'x',
      brand_prefs: '',
      calendar_intake: { events },
    },
    patternLibrary: [],
  };
}

describe('calendar.parseOutput', () => {
  test('parses one event and pairs schedule from intake by index', () => {
    const raw = `<calendar>
<event>
<title>Office Hours</title>
<description>Drop in for live Q&A and screen-share fixes.</description>
</event>
</calendar>`;
    const out = parseOutput(
      raw,
      buildInput([{ title: 'Office Hours', schedule: WEEKLY }]),
    );
    expect(out.events).toHaveLength(1);
    expect(out.events[0].title).toBe('Office Hours');
    expect(out.events[0].description).toMatch(/Q&A/);
    expect(out.events[0].schedule).toEqual(WEEKLY);
  });

  test('parses two events and stitches schedules by index, including one_off', () => {
    const raw = `<calendar>
<event>
<title>Weekly Q&A</title>
<description>Live questions, real answers.</description>
</event>
<event>
<title>Launch Workshop</title>
<description>Walk through your first launch step by step.</description>
</event>
</calendar>`;
    const out = parseOutput(
      raw,
      buildInput([
        { title: 'Weekly Q&A', schedule: WEEKLY },
        { title: 'Launch Workshop', schedule: ONE_OFF },
      ]),
    );
    expect(out.events.map((e) => e.title)).toEqual([
      'Weekly Q&A',
      'Launch Workshop',
    ]);
    expect(out.events[0].schedule).toEqual(WEEKLY);
    expect(out.events[1].schedule).toEqual(ONE_OFF);
  });

  test('throws when <calendar> wrapper is missing', () => {
    expect(() => parseOutput('hi')).toThrow(/missing <calendar>/);
  });

  test('throws when there are zero <event> tags', () => {
    expect(() => parseOutput('<calendar></calendar>')).toThrow(
      /no <event> tags/,
    );
  });

  test('throws when more than 10 events returned', () => {
    const block = Array.from({ length: 11 }, () => `
<event>
<title>Hello</title>
<description>desc</description>
</event>`).join('');
    expect(() => parseOutput(`<calendar>${block}</calendar>`)).toThrow(
      /events returned \(max 10\)/,
    );
  });

  test('throws when an event description exceeds 300 chars', () => {
    const longDesc = 'a'.repeat(301);
    const raw = `<calendar><event><title>X</title><description>${longDesc}</description></event></calendar>`;
    expect(() =>
      parseOutput(raw, buildInput([{ title: 'X', schedule: WEEKLY }])),
    ).toThrow(/description is 301 chars/);
  });

  test('falls back to placeholder schedule when input is omitted (parser-only callers)', () => {
    const raw = `<calendar><event><title>X</title><description>d</description></event></calendar>`;
    const out = parseOutput(raw);
    expect(out.events[0].schedule.type).toBe('weekly');
  });

  test('preserves monthly schedule (dayOfMonth + interval) through index stitching', () => {
    const raw = `<calendar><event><title>Full Moon Ceremony</title><description>Each month we gather to release and reset.</description></event></calendar>`;
    const out = parseOutput(
      raw,
      buildInput([{ title: 'Full Moon Ceremony', schedule: MONTHLY }]),
    );
    expect(out.events[0].schedule).toEqual(MONTHLY);
  });

  test('preserves yearly schedule (month + dayOfMonth) through index stitching', () => {
    const raw = `<calendar><event><title>Spring Equinox Ritual</title><description>Once a year we mark the seasonal turn.</description></event></calendar>`;
    const out = parseOutput(
      raw,
      buildInput([{ title: 'Spring Equinox Ritual', schedule: YEARLY }]),
    );
    expect(out.events[0].schedule).toEqual(YEARLY);
  });
});

describe('calendar.buildUserMessage', () => {
  test('renders <cadence> + <schedule> tags for weekly events', () => {
    const msg = buildUserMessage(
      buildInput([{ title: 'Weekly Q&A', schedule: WEEKLY }]),
    );
    expect(msg).toMatch(/<cadence>Every Monday<\/cadence>/);
    expect(msg).toMatch(/<schedule>Every Monday at 9:00 AM /);
  });

  test('threads monthly cadence into the prompt', () => {
    const msg = buildUserMessage(
      buildInput([{ title: 'Full Moon Ceremony', schedule: MONTHLY }]),
    );
    expect(msg).toMatch(/<cadence>The 15th of every month<\/cadence>/);
  });

  test('threads bi-weekly (weekly interval=2) cadence into the prompt', () => {
    const msg = buildUserMessage(
      buildInput([{ title: 'Bi-weekly Q&A', schedule: BIWEEKLY }]),
    );
    expect(msg).toMatch(/<cadence>Every other Sunday<\/cadence>/);
    expect(msg).toMatch(/<schedule>Every other Sunday at 9:00 AM /);
  });

  test('threads quarterly (monthly interval=3) cadence into the prompt', () => {
    const msg = buildUserMessage(
      buildInput([{ title: 'QBR Detox', schedule: QUARTERLY }]),
    );
    expect(msg).toContain('quarterly');
  });

  test('threads yearly cadence into the prompt', () => {
    const msg = buildUserMessage(
      buildInput([{ title: 'Spring Equinox Ritual', schedule: YEARLY }]),
    );
    expect(msg).toMatch(/<cadence>Annually on May 8<\/cadence>/);
  });

  test('mixes all four recurrence types in one prompt without losing order', () => {
    const msg = buildUserMessage(
      buildInput([
        { title: 'Weekly Q&A', schedule: WEEKLY },
        { title: 'Full Moon Ceremony', schedule: MONTHLY },
        { title: 'QBR Detox', schedule: QUARTERLY },
        { title: 'Annual Retreat', schedule: YEARLY },
        { title: 'Launch Workshop', schedule: ONE_OFF },
      ]),
    );
    const weeklyIdx = msg.indexOf('Weekly Q&A');
    const monthlyIdx = msg.indexOf('Full Moon Ceremony');
    const quarterlyIdx = msg.indexOf('QBR Detox');
    const yearlyIdx = msg.indexOf('Annual Retreat');
    const oneOffIdx = msg.indexOf('Launch Workshop');
    expect(weeklyIdx).toBeGreaterThan(-1);
    expect(monthlyIdx).toBeGreaterThan(weeklyIdx);
    expect(quarterlyIdx).toBeGreaterThan(monthlyIdx);
    expect(yearlyIdx).toBeGreaterThan(quarterlyIdx);
    expect(oneOffIdx).toBeGreaterThan(yearlyIdx);
  });
});
