"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
  MONTHLY_INTERVAL_MAX,
} from "@/types/schemas";
import { describeRecurrence } from "@/lib/calendar/format-schedule";

/**
 * Wizard repeater for calendar events. Each row captures:
 *   - title
 *   - recurrence type (weekly | monthly | yearly | one_off)
 *   - weekly:  dayOfWeek + interval + time + timezone
 *   - monthly: dayOfMonth + interval + time + timezone
 *   - yearly:  month + dayOfMonth + time + timezone
 *   - one_off: date + time + timezone
 *
 * The "Recurrence" select swaps the conditional fields in place; switching
 * types resets the type-specific fields so stale discriminant fields can't
 * leak into the wrong variant. Time + timezone survive the swap so the VA
 * doesn't lose them when correcting a wrong cadence pick.
 *
 * Row count is capped at CALENDAR_MAX_EVENTS. The repeater starts with one
 * row by default and shows Add / Remove buttons.
 */

type EventRow = CalendarEventIntake;
type RecurrenceType = EventSchedule["type"];

type RowErrors = {
  title?: string;
  schedule?: string;
  /** Field-level schedule errors. Optional; populated only when RHF surfaces them. */
  fields?: Partial<
    Record<
      | "dayOfWeek"
      | "dayOfMonth"
      | "month"
      | "interval"
      | "date"
      | "time"
      | "timezone",
      string
    >
  >;
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

const MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

/**
 * UI-only enum that the interval Select binds to. The persisted schedule
 * stores only the numeric `interval`; this enum drives whether the Custom
 * number input is shown.
 */
type IntervalMode = "monthly" | "quarterly" | "biannual" | "custom";

function intervalModeOf(interval: number): IntervalMode {
  if (interval === 1) return "monthly";
  if (interval === 3) return "quarterly";
  if (interval === 6) return "biannual";
  return "custom";
}

function intervalOfMode(mode: IntervalMode, currentInterval: number): number {
  if (mode === "monthly") return 1;
  if (mode === "quarterly") return 3;
  if (mode === "biannual") return 6;
  // "custom" — keep whatever's already there if it's already non-preset,
  // otherwise seed at 2 so the user immediately sees the input is active.
  return [1, 3, 6].includes(currentInterval) ? 2 : currentInterval;
}

/**
 * Weekly counterpart to IntervalMode. Parallel to the monthly helpers above
 * rather than a shared abstraction — the preset sets differ (weeks vs months)
 * and keeping them separate keeps each readable.
 */
type WeeklyIntervalMode = "weekly" | "biweekly" | "triweekly" | "custom";

function weeklyIntervalModeOf(interval: number): WeeklyIntervalMode {
  if (interval === 1) return "weekly";
  if (interval === 2) return "biweekly";
  if (interval === 3) return "triweekly";
  return "custom";
}

function weeklyIntervalOfMode(
  mode: WeeklyIntervalMode,
  currentInterval: number,
): number {
  if (mode === "weekly") return 1;
  if (mode === "biweekly") return 2;
  if (mode === "triweekly") return 3;
  // "custom" — keep a non-preset value as-is, otherwise seed at 4 so the
  // input lands above the presets and is visibly active.
  return [1, 2, 3].includes(currentInterval) ? 4 : currentInterval;
}

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
    interval: 1,
    time: "09:00",
    timezone: DEFAULT_TIMEZONE,
  };
}

export function makeDefaultMonthlySchedule(): EventSchedule {
  return {
    type: "monthly",
    dayOfMonth: 1,
    interval: 1,
    time: "09:00",
    timezone: DEFAULT_TIMEZONE,
  };
}

export function makeDefaultYearlySchedule(): EventSchedule {
  return {
    type: "yearly",
    month: 1,
    dayOfMonth: 1,
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

function makeDefaultScheduleOf(type: RecurrenceType): EventSchedule {
  switch (type) {
    case "weekly":
      return makeDefaultWeeklySchedule();
    case "monthly":
      return makeDefaultMonthlySchedule();
    case "yearly":
      return makeDefaultYearlySchedule();
    case "one_off":
      return makeDefaultOneOffSchedule();
  }
}

export function makeDefaultEvent(): EventRow {
  return { title: "", schedule: makeDefaultWeeklySchedule() };
}

type Props = {
  values: EventRow[];
  onChange: (next: EventRow[]) => void;
  errors?: (RowErrors | undefined)[];
};

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "weekly", label: "Recurring weekly" },
  { value: "monthly", label: "Recurring monthly" },
  { value: "yearly", label: "Recurring yearly" },
  { value: "one_off", label: "One-off date" },
];

const RECURRENCE_VALUES = RECURRENCE_OPTIONS.map((o) => o.value);

function isRecurrenceType(v: string | null | undefined): v is RecurrenceType {
  if (!v) return false;
  return (RECURRENCE_VALUES as string[]).includes(v);
}

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

  function setRecurrence(i: number, type: RecurrenceType) {
    const next = values.map((row, idx) => {
      if (idx !== i) return row;
      if (row.schedule.type === type) return row;
      const replacement = makeDefaultScheduleOf(type);
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
                  if (isRecurrenceType(v)) setRecurrence(i, v);
                }}
              >
                <SelectTrigger id={recurrenceId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground" data-testid={`events-${i}-cadence-preview`}>
                {describeRecurrence(row.schedule)}
              </p>
            </div>

            <RecurrenceFields
              rowIndex={i}
              schedule={row.schedule}
              fieldErrors={err?.fields}
              onScheduleChange={(patch) => updateSchedule(i, patch)}
            />

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

/* -------------------------------------------------------------------------- */
/* Per-recurrence sub-forms                                                   */
/* -------------------------------------------------------------------------- */

function RecurrenceFields({
  rowIndex,
  schedule,
  fieldErrors,
  onScheduleChange,
}: {
  rowIndex: number;
  schedule: EventSchedule;
  fieldErrors?: RowErrors["fields"];
  onScheduleChange: (patch: Partial<EventSchedule>) => void;
}) {
  if (schedule.type === "weekly") {
    const dayId = `events-${rowIndex}-day`;
    const intervalModeId = `events-${rowIndex}-weekly-interval-mode`;
    const intervalNumId = `events-${rowIndex}-weekly-interval`;
    const mode = weeklyIntervalModeOf(schedule.interval ?? 1);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={dayId} className="text-xs">
            Day of week
          </Label>
          <Select
            value={schedule.dayOfWeek}
            onValueChange={(v) => {
              if (v) onScheduleChange({ dayOfWeek: v as Weekday });
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
          {fieldErrors?.dayOfWeek ? (
            <p className="text-xs text-destructive">{fieldErrors.dayOfWeek}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={intervalModeId} className="text-xs">
            How often
          </Label>
          <Select
            value={mode}
            onValueChange={(v) => {
              const next = weeklyIntervalOfMode(
                v as WeeklyIntervalMode,
                schedule.interval ?? 1,
              );
              onScheduleChange({ interval: next });
            }}
          >
            <SelectTrigger id={intervalModeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Every week</SelectItem>
              <SelectItem value="biweekly">Every other week</SelectItem>
              <SelectItem value="triweekly">Every 3 weeks</SelectItem>
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {mode === "custom" ? (
            <div className="space-y-1.5">
              <Label htmlFor={intervalNumId} className="sr-only">
                Weeks between events
              </Label>
              <Input
                id={intervalNumId}
                type="number"
                min={1}
                max={MONTHLY_INTERVAL_MAX}
                value={schedule.interval ?? 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) onScheduleChange({ interval: n });
                }}
                aria-invalid={fieldErrors?.interval ? true : undefined}
                aria-label="Weeks between events"
              />
              <p className="text-xs text-muted-foreground">
                Weeks between events (1-{MONTHLY_INTERVAL_MAX})
              </p>
              {fieldErrors?.interval ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.interval}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (schedule.type === "monthly") {
    const dayId = `events-${rowIndex}-day-of-month`;
    const intervalModeId = `events-${rowIndex}-interval-mode`;
    const intervalNumId = `events-${rowIndex}-interval`;
    const mode = intervalModeOf(schedule.interval ?? 1);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={dayId} className="text-xs">
            Day of month
          </Label>
          <Input
            id={dayId}
            type="number"
            min={1}
            max={31}
            value={schedule.dayOfMonth}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onScheduleChange({ dayOfMonth: n });
            }}
            aria-invalid={fieldErrors?.dayOfMonth ? true : undefined}
          />
          {fieldErrors?.dayOfMonth ? (
            <p className="text-xs text-destructive">
              {fieldErrors.dayOfMonth}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={intervalModeId} className="text-xs">
            How often
          </Label>
          <Select
            value={mode}
            onValueChange={(v) => {
              const next = intervalOfMode(
                v as IntervalMode,
                schedule.interval ?? 1,
              );
              onScheduleChange({ interval: next });
            }}
          >
            <SelectTrigger id={intervalModeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Every month</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="biannual">Twice a year</SelectItem>
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {mode === "custom" ? (
            <div className="space-y-1.5">
              <Label htmlFor={intervalNumId} className="sr-only">
                Months between events
              </Label>
              <Input
                id={intervalNumId}
                type="number"
                min={1}
                max={MONTHLY_INTERVAL_MAX}
                value={schedule.interval ?? 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) onScheduleChange({ interval: n });
                }}
                aria-invalid={fieldErrors?.interval ? true : undefined}
                aria-label="Months between events"
              />
              <p className="text-xs text-muted-foreground">
                Months between events (1-{MONTHLY_INTERVAL_MAX})
              </p>
              {fieldErrors?.interval ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.interval}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (schedule.type === "yearly") {
    const monthId = `events-${rowIndex}-month`;
    const dayId = `events-${rowIndex}-day-of-month`;
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={monthId} className="text-xs">
            Month
          </Label>
          <Select
            value={String(schedule.month)}
            onValueChange={(v) => {
              const n = Number(v);
              if (Number.isFinite(n)) onScheduleChange({ month: n });
            }}
          >
            <SelectTrigger id={monthId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors?.month ? (
            <p className="text-xs text-destructive">{fieldErrors.month}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={dayId} className="text-xs">
            Day of month
          </Label>
          <Input
            id={dayId}
            type="number"
            min={1}
            max={31}
            value={schedule.dayOfMonth}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onScheduleChange({ dayOfMonth: n });
            }}
            aria-invalid={fieldErrors?.dayOfMonth ? true : undefined}
          />
          {fieldErrors?.dayOfMonth ? (
            <p className="text-xs text-destructive">
              {fieldErrors.dayOfMonth}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // one_off — controlled shadcn Calendar + Popover, not the native date input.
  // Native <input type="date"> has a known cross-browser bug where editing the
  // year segment can wipe partial input; the DatePicker is timezone-safe
  // (date-fns format/parse, never .toISOString()) and renders identically
  // across Chrome/Safari/Firefox.
  const dateId = `events-${rowIndex}-date`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={dateId} className="text-xs">
        Date
      </Label>
      <DatePicker
        id={dateId}
        value={schedule.date || undefined}
        onChange={(value) => onScheduleChange({ date: value })}
        placeholder="Pick a date"
        aria-invalid={fieldErrors?.date ? true : undefined}
      />
      {fieldErrors?.date ? (
        <p className="text-xs text-destructive">{fieldErrors.date}</p>
      ) : null}
    </div>
  );
}
