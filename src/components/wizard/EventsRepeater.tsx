"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CalendarEventIntake,
  EventSchedule,
  Weekday,
} from "@/types/schemas";
import {
  CALENDAR_EVENT_TITLE_MAX,
  CALENDAR_MAX_EVENTS,
} from "@/types/schemas";

/**
 * Wizard repeater for calendar events. Each row captures:
 *   - title
 *   - recurrence type (weekly | one_off)
 *   - weekly:  dayOfWeek + time + timezone
 *   - one_off: date + time + timezone
 *
 * The "Recurrence" select swaps the conditional fields in place; switching
 * types resets the type-specific fields so a stale dayOfWeek can't leak into
 * a one_off payload (the discriminated union would reject it on validation,
 * but a clean reset gives a clean re-render).
 *
 * Row count is capped at CALENDAR_MAX_EVENTS. The repeater starts with one
 * row by default and shows Add / Remove buttons.
 */

type EventRow = CalendarEventIntake;

type RowErrors = {
  title?: string;
  schedule?: string;
  /** Field-level schedule errors. Optional; populated only when RHF surfaces them. */
  fields?: Partial<Record<"dayOfWeek" | "date" | "time" | "timezone", string>>;
};

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];

// TODO: pull from creator profile once a timezone field lands on the intake.
export const DEFAULT_TIMEZONE = "America/New_York";

// Curated short list — keeps the dropdown small for VAs. Free-text fallback
// covers anyone outside these zones; schema only requires a non-empty string.
const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "America/New_York (Eastern)" },
  { value: "America/Chicago", label: "America/Chicago (Central)" },
  { value: "America/Denver", label: "America/Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
  { value: "America/Phoenix", label: "America/Phoenix (Arizona)" },
  { value: "America/Anchorage", label: "America/Anchorage (Alaska)" },
  { value: "Pacific/Honolulu", label: "Pacific/Honolulu (Hawaii)" },
  { value: "America/Mexico_City", label: "America/Mexico_City" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "UTC", label: "UTC" },
];

export function makeDefaultWeeklySchedule(): EventSchedule {
  return {
    type: "weekly",
    dayOfWeek: "mon",
    time: "09:00",
    timezone: DEFAULT_TIMEZONE,
  };
}

export function makeDefaultOneOffSchedule(): EventSchedule {
  return {
    type: "one_off",
    date: "",
    time: "09:00",
    timezone: DEFAULT_TIMEZONE,
  };
}

export function makeDefaultEvent(): EventRow {
  return { title: "", schedule: makeDefaultWeeklySchedule() };
}

type Props = {
  values: EventRow[];
  onChange: (next: EventRow[]) => void;
  errors?: (RowErrors | undefined)[];
};

export function EventsRepeater({ values, onChange, errors }: Props) {
  const atMax = values.length >= CALENDAR_MAX_EVENTS;

  function updateRow(i: number, patch: Partial<EventRow>) {
    const next = values.map((row, idx) =>
      idx === i ? { ...row, ...patch } : row,
    );
    onChange(next);
  }

  function updateSchedule(i: number, patch: Partial<EventSchedule>) {
    const next = values.map((row, idx) => {
      if (idx !== i) return row;
      // Cast: discriminant ('type') is never patched here without resetting the
      // full schedule via setType(), so the spread keeps the union variant
      // consistent.
      return {
        ...row,
        schedule: { ...row.schedule, ...patch } as EventSchedule,
      };
    });
    onChange(next);
  }

  function setRecurrence(i: number, type: "weekly" | "one_off") {
    const next = values.map((row, idx) => {
      if (idx !== i) return row;
      if (row.schedule.type === type) return row;
      const replacement: EventSchedule =
        type === "weekly"
          ? makeDefaultWeeklySchedule()
          : makeDefaultOneOffSchedule();
      // Preserve time + timezone across the type swap so the VA doesn't lose
      // them when they realize they picked the wrong recurrence.
      replacement.time = row.schedule.time;
      replacement.timezone = row.schedule.timezone;
      return { ...row, schedule: replacement };
    });
    onChange(next);
  }

  function removeRow(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }

  function addRow() {
    onChange([...values, makeDefaultEvent()]);
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">
        Events ({values.length}/{CALENDAR_MAX_EVENTS})
      </legend>

      {values.map((row, i) => {
        const err = errors?.[i];
        const titleId = `events-${i}-title`;
        const recurrenceId = `events-${i}-recurrence`;
        const timeId = `events-${i}-time`;
        const tzId = `events-${i}-timezone`;
        const dayId = `events-${i}-day`;
        const dateId = `events-${i}-date`;
        return (
          <div key={i} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Event {i + 1}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeRow(i)}
                disabled={values.length <= 1}
              >
                Remove
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={titleId} className="text-xs">
                Title
                <span className="ml-1 text-muted-foreground">
                  (max {CALENDAR_EVENT_TITLE_MAX})
                </span>
              </Label>
              <Input
                id={titleId}
                value={row.title}
                maxLength={CALENDAR_EVENT_TITLE_MAX}
                onChange={(e) => updateRow(i, { title: e.target.value })}
                placeholder="e.g. Weekly Q&A"
                aria-invalid={err?.title ? true : undefined}
              />
              {err?.title ? (
                <p className="text-xs text-destructive">{err.title}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={recurrenceId} className="text-xs">
                Recurrence
              </Label>
              <Select
                value={row.schedule.type}
                onValueChange={(v) => {
                  if (v === "weekly" || v === "one_off") setRecurrence(i, v);
                }}
              >
                <SelectTrigger id={recurrenceId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Recurring weekly</SelectItem>
                  <SelectItem value="one_off">One-off date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {row.schedule.type === "weekly" ? (
              <div className="space-y-1.5">
                <Label htmlFor={dayId} className="text-xs">
                  Day of week
                </Label>
                <Select
                  value={row.schedule.dayOfWeek}
                  onValueChange={(v) => {
                    if (v) updateSchedule(i, { dayOfWeek: v as Weekday });
                  }}
                >
                  <SelectTrigger id={dayId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err?.fields?.dayOfWeek ? (
                  <p className="text-xs text-destructive">
                    {err.fields.dayOfWeek}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={dateId} className="text-xs">
                  Date
                </Label>
                <Input
                  id={dateId}
                  type="date"
                  value={row.schedule.date}
                  onChange={(e) =>
                    updateSchedule(i, { date: e.target.value })
                  }
                  aria-invalid={err?.fields?.date ? true : undefined}
                />
                {err?.fields?.date ? (
                  <p className="text-xs text-destructive">{err.fields.date}</p>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={timeId} className="text-xs">
                  Time
                </Label>
                <Input
                  id={timeId}
                  type="time"
                  value={row.schedule.time}
                  onChange={(e) =>
                    updateSchedule(i, { time: e.target.value })
                  }
                  aria-invalid={err?.fields?.time ? true : undefined}
                />
                {err?.fields?.time ? (
                  <p className="text-xs text-destructive">{err.fields.time}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={tzId} className="text-xs">
                  Timezone
                </Label>
                <Select
                  value={row.schedule.timezone}
                  onValueChange={(v) =>
                    updateSchedule(i, { timezone: v ?? DEFAULT_TIMEZONE })
                  }
                >
                  <SelectTrigger id={tzId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err?.fields?.timezone ? (
                  <p className="text-xs text-destructive">
                    {err.fields.timezone}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={addRow} disabled={atMax}>
        Add event ({values.length}/{CALENDAR_MAX_EVENTS})
      </Button>
    </fieldset>
  );
}
