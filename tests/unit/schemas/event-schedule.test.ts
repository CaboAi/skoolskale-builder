import { describe, expect, test } from 'vitest';
import {
  EventScheduleSchema,
  MONTHLY_INTERVAL_MAX,
} from '@/types/schemas';

const baseTime = { time: '09:00', timezone: 'America/New_York' };

describe('EventScheduleSchema', () => {
  describe('weekly (backward-compat)', () => {
    test('accepts a valid weekly schedule, interval defaults to 1', () => {
      const result = EventScheduleSchema.safeParse({
        type: 'weekly',
        dayOfWeek: 'mon',
        ...baseTime,
      });
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'weekly') {
        expect(result.data.interval).toBe(1);
      }
    });

    test('rejects a bogus dayOfWeek', () => {
      expect(
        EventScheduleSchema.safeParse({
          type: 'weekly',
          dayOfWeek: 'funday',
          ...baseTime,
        }).success,
      ).toBe(false);
    });
  });

  describe('weekly interval', () => {
    test('accepts bi-weekly (interval=2) and every-3-weeks (interval=3)', () => {
      for (const interval of [2, 3]) {
        const result = EventScheduleSchema.safeParse({
          type: 'weekly',
          dayOfWeek: 'sun',
          interval,
          ...baseTime,
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.type === 'weekly') {
          expect(result.data.interval).toBe(interval);
        }
      }
    });

    test('rejects interval=0, negative, and above the cap', () => {
      for (const interval of [0, -1, MONTHLY_INTERVAL_MAX + 1]) {
        expect(
          EventScheduleSchema.safeParse({
            type: 'weekly',
            dayOfWeek: 'mon',
            interval,
            ...baseTime,
          }).success,
        ).toBe(false);
      }
    });
  });

  describe('one_off (backward-compat)', () => {
    test('accepts a valid one_off schedule', () => {
      expect(
        EventScheduleSchema.safeParse({
          type: 'one_off',
          date: '2026-06-12',
          ...baseTime,
        }).success,
      ).toBe(true);
    });

    test('rejects a bad ISO date', () => {
      expect(
        EventScheduleSchema.safeParse({
          type: 'one_off',
          date: '06/12/2026',
          ...baseTime,
        }).success,
      ).toBe(false);
    });
  });

  describe('monthly', () => {
    test('accepts dayOfMonth=15, default interval defaults to 1', () => {
      const result = EventScheduleSchema.safeParse({
        type: 'monthly',
        dayOfMonth: 15,
        ...baseTime,
      });
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'monthly') {
        expect(result.data.interval).toBe(1);
      }
    });

    test('accepts quarterly (interval=3) and semi-annual (6)', () => {
      for (const interval of [3, 6]) {
        expect(
          EventScheduleSchema.safeParse({
            type: 'monthly',
            dayOfMonth: 1,
            interval,
            ...baseTime,
          }).success,
        ).toBe(true);
      }
    });

    test('accepts dayOfMonth up to 31 (renderer skips short months)', () => {
      expect(
        EventScheduleSchema.safeParse({
          type: 'monthly',
          dayOfMonth: 31,
          ...baseTime,
        }).success,
      ).toBe(true);
    });

    test('rejects dayOfMonth=32 and dayOfMonth=0', () => {
      for (const dayOfMonth of [32, 0]) {
        expect(
          EventScheduleSchema.safeParse({
            type: 'monthly',
            dayOfMonth,
            ...baseTime,
          }).success,
        ).toBe(false);
      }
    });

    test('rejects interval=0 and interval above cap', () => {
      for (const interval of [0, MONTHLY_INTERVAL_MAX + 1, 15]) {
        expect(
          EventScheduleSchema.safeParse({
            type: 'monthly',
            dayOfMonth: 1,
            interval,
            ...baseTime,
          }).success,
        ).toBe(false);
      }
    });
  });

  describe('yearly', () => {
    test('accepts a valid yearly schedule', () => {
      expect(
        EventScheduleSchema.safeParse({
          type: 'yearly',
          month: 5,
          dayOfMonth: 8,
          ...baseTime,
        }).success,
      ).toBe(true);
    });

    test('allows Feb 29 (leap year only — caller-handled)', () => {
      expect(
        EventScheduleSchema.safeParse({
          type: 'yearly',
          month: 2,
          dayOfMonth: 29,
          ...baseTime,
        }).success,
      ).toBe(true);
    });

    test('rejects Feb 30 and Feb 31', () => {
      for (const dayOfMonth of [30, 31]) {
        expect(
          EventScheduleSchema.safeParse({
            type: 'yearly',
            month: 2,
            dayOfMonth,
            ...baseTime,
          }).success,
        ).toBe(false);
      }
    });

    test('rejects day 31 in 30-day months (Apr/Jun/Sep/Nov)', () => {
      for (const month of [4, 6, 9, 11]) {
        expect(
          EventScheduleSchema.safeParse({
            type: 'yearly',
            month,
            dayOfMonth: 31,
            ...baseTime,
          }).success,
        ).toBe(false);
      }
    });

    test('rejects month=0 and month=13', () => {
      for (const month of [0, 13]) {
        expect(
          EventScheduleSchema.safeParse({
            type: 'yearly',
            month,
            dayOfMonth: 1,
            ...baseTime,
          }).success,
        ).toBe(false);
      }
    });
  });

  test('rejects unknown discriminant', () => {
    expect(
      EventScheduleSchema.safeParse({
        type: 'forever',
        ...baseTime,
      }).success,
    ).toBe(false);
  });
});
