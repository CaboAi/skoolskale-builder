import { describe, expect, test } from 'vitest';
import {
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

describe('formatSchedule', () => {
  test('weekly renders as "Every <Weekday> at <12h time> <tz>"', () => {
    const out = formatSchedule({
      type: 'weekly',
      dayOfWeek: 'mon',
      time: '09:00',
      timezone: 'America/Los_Angeles',
    });
    // Tz abbreviation depends on DST at runtime — assert structure only.
    expect(out).toMatch(/^Every Monday at 9:00 AM /);
    expect(out).toMatch(/(PST|PDT|America\/Los_Angeles)$/);
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
