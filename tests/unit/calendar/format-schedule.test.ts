import { describe, expect, test } from 'vitest';
import {
  describeRecurrence,
  formatSchedule,
  formatTime12h,
} from '@/lib/calendar/format-schedule';

describe('formatTime12h', () => {
  test('formats midnight as 12:00 AM', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
  });

  test('formats noon as 12:00 PM', () => {
    expect(formatTime12h('12:00')).toBe('12:00 PM');
  });

  test('keeps minutes and adds AM in the morning', () => {
    expect(formatTime12h('09:30')).toBe('9:30 AM');
  });

  test('subtracts 12 from afternoon hours and adds PM', () => {
    expect(formatTime12h('17:45')).toBe('5:45 PM');
  });

  test('falls back to the raw string for malformed inputs', () => {
    expect(formatTime12h('nope')).toBe('nope');
  });
});

describe('describeRecurrence', () => {
  test('weekly returns "Every <Weekday>"', () => {
    expect(
      describeRecurrence({
        type: 'weekly',
        dayOfWeek: 'mon',
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('Every Monday');
  });

  test('monthly with interval=1 returns "The Nth of every month"', () => {
    expect(
      describeRecurrence({
        type: 'monthly',
        dayOfMonth: 15,
        interval: 1,
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('The 15th of every month');
  });

  test('monthly with interval=2 returns "The Nth, every 2 months"', () => {
    expect(
      describeRecurrence({
        type: 'monthly',
        dayOfMonth: 1,
        interval: 2,
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('The 1st, every 2 months');
  });

  test('monthly with interval=3 returns the quarterly phrasing', () => {
    expect(
      describeRecurrence({
        type: 'monthly',
        dayOfMonth: 1,
        interval: 3,
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('The 1st, every 3 months (quarterly)');
  });

  test('monthly with interval=6 returns "twice a year"', () => {
    expect(
      describeRecurrence({
        type: 'monthly',
        dayOfMonth: 3,
        interval: 6,
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('The 3rd, twice a year');
  });

  test('monthly with interval=12 returns "once a year"', () => {
    expect(
      describeRecurrence({
        type: 'monthly',
        dayOfMonth: 22,
        interval: 12,
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('The 22nd, once a year');
  });

  test('ordinal suffixes: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st', () => {
    const days: [number, string][] = [
      [1, '1st'],
      [2, '2nd'],
      [3, '3rd'],
      [4, '4th'],
      [11, '11th'],
      [12, '12th'],
      [13, '13th'],
      [21, '21st'],
    ];
    for (const [day, label] of days) {
      const out = describeRecurrence({
        type: 'monthly',
        dayOfMonth: day,
        interval: 1,
        time: '09:00',
        timezone: 'UTC',
      });
      expect(out).toBe(`The ${label} of every month`);
    }
  });

  test('yearly returns "Annually on <Month> <day>"', () => {
    expect(
      describeRecurrence({
        type: 'yearly',
        month: 5,
        dayOfMonth: 8,
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('Annually on May 8');
  });

  test('one_off returns "On <Month> <day>, <year>"', () => {
    expect(
      describeRecurrence({
        type: 'one_off',
        date: '2026-06-12',
        time: '09:00',
        timezone: 'UTC',
      }),
    ).toBe('On June 12, 2026');
  });
});

describe('formatSchedule', () => {
  test('weekly renders as "Every <Weekday> at <12h time> <tz>"', () => {
    const out = formatSchedule({
      type: 'weekly',
      dayOfWeek: 'mon',
      time: '09:00',
      timezone: 'America/Los_Angeles',
    });
    expect(out).toMatch(/^Every Monday at 9:00 AM /);
    expect(out).toMatch(/(PST|PDT|America\/Los_Angeles)$/);
  });

  test('monthly interval=1 renders the every-month phrasing + time/tz', () => {
    const out = formatSchedule({
      type: 'monthly',
      dayOfMonth: 15,
      interval: 1,
      time: '09:00',
      timezone: 'America/Los_Angeles',
    });
    expect(out).toMatch(/^The 15th of every month at 9:00 AM /);
    expect(out).toMatch(/(PST|PDT|America\/Los_Angeles)$/);
  });

  test('monthly interval=3 renders the quarterly phrasing + time/tz', () => {
    const out = formatSchedule({
      type: 'monthly',
      dayOfMonth: 1,
      interval: 3,
      time: '14:00',
      timezone: 'America/Los_Angeles',
    });
    expect(out).toMatch(/^The 1st, every 3 months at 2:00 PM /);
  });

  test('yearly renders "Annually on <Month> <day> at <time> <tz>"', () => {
    const out = formatSchedule({
      type: 'yearly',
      month: 5,
      dayOfMonth: 8,
      time: '09:00',
      timezone: 'America/New_York',
    });
    expect(out).toMatch(/^Annually on May 8 at 9:00 AM /);
    expect(out).toMatch(/(EST|EDT|America\/New_York)$/);
  });

  test('one_off renders as "<Month D, YYYY> at <12h time> <tz>"', () => {
    const out = formatSchedule({
      type: 'one_off',
      date: '2026-08-08',
      time: '11:00',
      timezone: 'America/New_York',
    });
    expect(out).toMatch(/^August 8, 2026 at 11:00 AM /);
    expect(out).toMatch(/(EST|EDT|America\/New_York)$/);
  });

  test('falls back to the IANA name when the timezone is invalid', () => {
    const out = formatSchedule({
      type: 'weekly',
      dayOfWeek: 'thu',
      time: '14:30',
      timezone: 'Not/A_Real_Zone',
    });
    expect(out).toBe('Every Thursday at 2:30 PM Not/A_Real_Zone');
  });
});
