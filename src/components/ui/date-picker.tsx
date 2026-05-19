"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Controlled date picker that replaces native `<input type="date">`.
 *
 * Why the wrapper exists:
 *   - Native HTML5 date inputs render wildly differently per browser
 *     (Chrome shows a popover, Safari shows a wheel picker, Firefox
 *     shows nothing on macOS until clicked), and have a known bug where
 *     editing the year segment can wipe the partial input.
 *   - This component renders a Popover-backed Calendar with month + year
 *     dropdowns so VAs can move through the calendar without keystroke
 *     trickery.
 *
 * **Timezone safety:** stores + emits ISO date strings (YYYY-MM-DD)
 * using `date-fns` `format(date, "yyyy-MM-dd")` and parses them back
 * with `parse(value, "yyyy-MM-dd", new Date())`. Do NOT swap these for
 * `.toISOString()` / `new Date(value)` — both interpret the string as
 * UTC, which off-by-ones every user west of the prime meridian
 * (including all of the Americas).
 */

export type DatePickerProps = {
  /** ISO date string YYYY-MM-DD. */
  value: string | undefined;
  /** Emits an ISO date string YYYY-MM-DD. */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Lower bound of the year dropdown (inclusive). Defaults to current year - 1. */
  fromYear?: number;
  /** Upper bound of the year dropdown (inclusive). Defaults to current year + 5. */
  toYear?: number;
  /** Optional id passed through to the trigger button for label association. */
  id?: string;
  /** Optional className on the trigger button — for layout overrides at call sites. */
  className?: string;
  /** Forwarded to the trigger button for inline error styling. */
  "aria-invalid"?: boolean;
};

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "PPP"; // e.g. "January 15th, 2026"

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  // parse() with a reference date keeps the result in LOCAL time, which is
  // exactly what we want — the YYYY-MM-DD string represents a calendar day,
  // not an instant.
  const parsed = parse(value, ISO_DATE_FORMAT, new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  fromYear,
  toYear,
  id,
  className,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = parseIsoDate(value);

  const currentYear = new Date().getFullYear();
  const startYear = fromYear ?? currentYear - 1;
  const endYear = toYear ?? currentYear + 5;
  // react-day-picker v10 uses startMonth/endMonth (not fromYear/toYear) to
  // bound the year dropdown. Use Jan 1 of the start year and Dec 31 of the
  // end year so the dropdown includes every month of the boundary years.
  const startMonth = new Date(startYear, 0, 1);
  const endMonth = new Date(endYear, 11, 31);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onChange(format(date, ISO_DATE_FORMAT));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            data-slot="date-picker-trigger"
            className={cn(
              "h-8 w-full justify-start gap-2 px-2.5 py-1 text-left font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4 opacity-70" />
            {selected ? (
              <span data-slot="date-picker-value">
                {format(selected, DISPLAY_FORMAT)}
              </span>
            ) : (
              <span data-slot="date-picker-placeholder">{placeholder}</span>
            )}
          </Button>
        )}
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          defaultMonth={selected ?? new Date()}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
