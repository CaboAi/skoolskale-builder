import type { EventSchedule, Weekday } from "@/types/schemas";

/**
 * Human-readable formatting for a calendar event's schedule.
 *
 * Storage keeps time as 24-hour HH:mm in an IANA timezone (e.g.,
 * "America/New_York"). For display we render 12-hour AM/PM plus a short
 * timezone abbreviation derived via Intl.DateTimeFormat — falling back to the
 * raw IANA name when the runtime can't resolve a short form.
 *
 * Weekly:  "Every Monday at 9:00 AM PST"
 * One-off: "August 8, 2026 at 9:00 AM PST"
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

export function formatSchedule(schedule: EventSchedule): string {
  if (schedule.type === "weekly") {
    const ref = nextOccurrenceUTC(WEEKDAY_INDEX[schedule.dayOfWeek], schedule.time);
    const tz = shortTimezone(schedule.timezone, ref);
    return `Every ${WEEKDAY_LABELS[schedule.dayOfWeek]} at ${formatTime12h(schedule.time)} ${tz}`;
  }
  const ref = oneOffReferenceUTC(schedule.date, schedule.time);
  const tz = shortTimezone(schedule.timezone, ref);
  return `${formatDateLong(schedule.date)} at ${formatTime12h(schedule.time)} ${tz}`;
}
