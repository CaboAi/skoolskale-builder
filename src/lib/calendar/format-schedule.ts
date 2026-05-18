import type { EventSchedule, Weekday } from "@/types/schemas";

/**
 * Human-readable formatting for a calendar event's schedule.
 *
 * Two helpers, by design:
 *
 * - describeRecurrence: cadence-only, no time/tz. The short phrase a VA reads
 *   under the form field and Claude reads in the generator prompt to ground
 *   the description in the right cadence. Examples:
 *     "Every Monday"
 *     "The 15th of every month"
 *     "The 15th, every 3 months (quarterly)"
 *     "Annually on May 8"
 *     "On June 12, 2026"
 *
 * - formatSchedule: cadence + time + IANA-short timezone. The fuller phrase
 *   rendered on the dashboard, the export view, and the dev-only schedule
 *   echo in the generator prompt. Examples:
 *     "Every Monday at 9:00 AM PST"
 *     "The 15th of every month at 9:00 AM PST"
 *     "Annually on May 8 at 9:00 AM PST"
 *     "August 8, 2026 at 9:00 AM PST"
 *
 * Storage keeps time as 24-hour HH:mm in an IANA timezone (e.g.
 * "America/New_York"). For display we render 12-hour AM/PM plus a short
 * timezone abbreviation derived via Intl.DateTimeFormat — falling back to the
 * raw IANA name when the runtime can't resolve a short form.
 */

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatTime12h(time: string): string {
  // Expects HH:mm 24-hour; falls back to the raw string if the input isn't
  // shaped like the schema demands (defensive — schema validation should have
  // caught it upstream).
  const m = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return time;
  const hour24 = Number(m[1]);
  const minute = m[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

/**
 * Resolve a short timezone label (e.g., "PST") for the given IANA zone, using
 * a reference Date so the abbreviation reflects DST at that moment. Returns
 * the IANA string itself when Intl can't produce a short form.
 */
export function shortTimezone(timezone: string, reference: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const parts = fmt.formatToParts(reference);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value;
    return tz && tz.length > 0 ? tz : timezone;
  } catch {
    return timezone;
  }
}

function formatDateLong(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const monthLabel = MONTH_LABELS[month - 1] ?? `Month ${month}`;
  return `${monthLabel} ${day}, ${year}`;
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  const last = day % 10;
  if (last === 1) return "st";
  if (last === 2) return "nd";
  if (last === 3) return "rd";
  return "th";
}

function ordinal(day: number): string {
  return `${day}${ordinalSuffix(day)}`;
}

function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? `Month ${month}`;
}

function nextOccurrenceUTC(weekdayIndex: number, time: string): Date {
  // Build an anchor Date (UTC midnight today) and roll forward to the next
  // occurrence of weekdayIndex. Used purely so Intl can pick a DST-correct
  // timezone label for weekly events — not for display arithmetic.
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const delta = (weekdayIndex - today.getUTCDay() + 7) % 7;
  const [h, m] = time.split(":").map(Number);
  return new Date(
    today.getTime() +
      delta * 24 * 60 * 60 * 1000 +
      (h ?? 0) * 60 * 60 * 1000 +
      (m ?? 0) * 60 * 1000,
  );
}

function oneOffReferenceUTC(isoDate: string, time: string): Date {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [hh, mm] = time.split(":").map(Number);
  if (!m) return new Date();
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh ?? 0, mm ?? 0),
  );
}

function monthlyReferenceUTC(dayOfMonth: number, time: string): Date {
  // Anchor the next occurrence at noon UTC on `dayOfMonth` in the current or
  // next month — purely for DST-aware tz abbreviation; not used for display.
  const now = new Date();
  const [h, m] = time.split(":").map(Number);
  const anchor = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      Math.min(dayOfMonth, 28),
      h ?? 0,
      m ?? 0,
    ),
  );
  return anchor.getTime() < now.getTime()
    ? new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          Math.min(dayOfMonth, 28),
          h ?? 0,
          m ?? 0,
        ),
      )
    : anchor;
}

function yearlyReferenceUTC(month: number, day: number, time: string): Date {
  const now = new Date();
  const [h, m] = time.split(":").map(Number);
  const safeDay = month === 2 && day === 29 ? 28 : day;
  return new Date(
    Date.UTC(now.getUTCFullYear(), month - 1, safeDay, h ?? 0, m ?? 0),
  );
}

/**
 * Cadence-only phrase. No time, no timezone. Used by the wizard preview, the
 * generator prompt, and any caller that wants to surface the recurrence
 * pattern in isolation.
 */
export function describeRecurrence(schedule: EventSchedule): string {
  switch (schedule.type) {
    case "weekly":
      return `Every ${WEEKDAY_LABELS[schedule.dayOfWeek]}`;
    case "monthly": {
      const day = ordinal(schedule.dayOfMonth);
      const interval = schedule.interval ?? 1;
      if (interval === 1) return `The ${day} of every month`;
      if (interval === 3) return `The ${day}, every 3 months (quarterly)`;
      if (interval === 6) return `The ${day}, twice a year`;
      if (interval === 12) return `The ${day}, once a year`;
      return `The ${day}, every ${interval} months`;
    }
    case "yearly":
      return `Annually on ${monthLabel(schedule.month)} ${schedule.dayOfMonth}`;
    case "one_off":
      return `On ${formatDateLong(schedule.date)}`;
  }
}

/**
 * Cadence + time + IANA-short timezone. Stable surface for the dashboard,
 * export view, and dev-only generator echo.
 */
export function formatSchedule(schedule: EventSchedule): string {
  const time12h = formatTime12h(schedule.time);
  switch (schedule.type) {
    case "weekly": {
      const ref = nextOccurrenceUTC(
        WEEKDAY_INDEX[schedule.dayOfWeek],
        schedule.time,
      );
      const tz = shortTimezone(schedule.timezone, ref);
      return `Every ${WEEKDAY_LABELS[schedule.dayOfWeek]} at ${time12h} ${tz}`;
    }
    case "monthly": {
      const ref = monthlyReferenceUTC(schedule.dayOfMonth, schedule.time);
      const tz = shortTimezone(schedule.timezone, ref);
      const day = ordinal(schedule.dayOfMonth);
      const interval = schedule.interval ?? 1;
      const cadence =
        interval === 1
          ? `The ${day} of every month`
          : interval === 3
            ? `The ${day}, every 3 months`
            : interval === 6
              ? `The ${day}, twice a year`
              : `The ${day}, every ${interval} months`;
      return `${cadence} at ${time12h} ${tz}`;
    }
    case "yearly": {
      const ref = yearlyReferenceUTC(
        schedule.month,
        schedule.dayOfMonth,
        schedule.time,
      );
      const tz = shortTimezone(schedule.timezone, ref);
      return `Annually on ${monthLabel(schedule.month)} ${schedule.dayOfMonth} at ${time12h} ${tz}`;
    }
    case "one_off": {
      const ref = oneOffReferenceUTC(schedule.date, schedule.time);
      const tz = shortTimezone(schedule.timezone, ref);
      return `${formatDateLong(schedule.date)} at ${time12h} ${tz}`;
    }
  }
}
