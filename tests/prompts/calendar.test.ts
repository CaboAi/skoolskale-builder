import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/calendar';
import type { GeneratorInput } from '@/types/generators';

const WEEKLY = {
  type: 'weekly' as const,
  dayOfWeek: 'mon' as const,
  time: '09:00',
  timezone: 'America/New_York',
};

const ONE_OFF = {
  type: 'one_off' as const,
  date: '2026-08-08',
  time: '11:00',
  timezone: 'America/Los_Angeles',
};

function buildInput(
  events: { title: string; schedule: typeof WEEKLY | typeof ONE_OFF }[],
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
});
