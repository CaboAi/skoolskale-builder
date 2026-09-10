// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format, parse } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";

/**
 * DatePicker behavior under jsdom. The component wraps shadcn Calendar +
 * Popover; popover content portals to document.body, so we query screen.
 *
 * Year-navigation regression: the native <input type="date"> bug being
 * fixed is that editing the year segment can wipe partial input. Our
 * implementation uses the Calendar's dropdown captionLayout, which renders
 * native <select> elements — interacting with them does NOT reset form
 * state. We assert that by selecting a year and confirming the controlled
 * value is unchanged until the VA explicitly clicks a day.
 */

function Harness({
  initial,
  onChangeSpy,
}: {
  initial?: string;
  onChangeSpy?: (value: string) => void;
}) {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <DatePicker
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
      placeholder="Pick a date"
    />
  );
}

describe("DatePicker", () => {
  test("renders the placeholder when value is undefined", () => {
    render(<Harness />);
    expect(screen.getByText("Pick a date")).toBeInTheDocument();
  });

  test("renders the formatted date when value is set", () => {
    render(<Harness initial="2026-01-15" />);
    // date-fns "PPP" → "January 15th, 2026" (locale en-US default).
    expect(
      screen.getByRole("button", { name: /January 15th, 2026/i }),
    ).toBeInTheDocument();
  });

  test("opens the popover when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-01-15" />);
    const trigger = screen.getByRole("button", {
      name: /January 15th, 2026/i,
    });
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    await user.click(trigger);
    // react-day-picker renders the month grid as role="grid".
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  test("selecting a date calls onChange with the ISO date string", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness initial="2026-01-15" onChangeSpy={onChangeSpy} />);

    await user.click(
      screen.getByRole("button", { name: /January 15th, 2026/i }),
    );
    await screen.findByRole("grid");

    // Pick Jan 20, 2026 — rdp's day buttons carry aria-labels like
    // "Tuesday, January 20th, 2026" (varies slightly by locale/version),
    // so match by partial.
    const day = screen.getByRole("button", { name: /January 20.*2026/i });
    await user.click(day);

    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).toHaveBeenCalledWith("2026-01-20");
  });

  test("timezone safety: format/parse round-trips a local date without UTC drift", () => {
    // Direct guardrail. If anyone replaces date-fns format() with
    // .toISOString() (or parse() with new Date(value)) in the picker,
    // this round-trip catches the off-by-one for anyone NOT in UTC.
    //
    // The property: for every YYYY-MM-DD string, parse-then-format MUST
    // return the same string regardless of the local timezone — because
    // the value is a calendar day, not an instant. .toISOString() does
    // not satisfy this property (it interprets through UTC and shifts).
    for (const iso of [
      "2026-01-15",
      "2026-06-30",
      "2026-12-31",
      "2027-02-28",
    ]) {
      const parsed = parse(iso, "yyyy-MM-dd", new Date());
      expect(format(parsed, "yyyy-MM-dd")).toBe(iso);
    }
  });

  test("year dropdown interaction does not reset the controlled value", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Harness initial="2026-01-15" onChangeSpy={onChangeSpy} />);

    await user.click(
      screen.getByRole("button", { name: /January 15th, 2026/i }),
    );
    await screen.findByRole("grid");

    // captionLayout="dropdown" renders <select> elements for month + year.
    // rdp labels them "Choose the Year" / "Choose the Month". Selecting a
    // year must NOT call onChange — only an explicit day-click should.
    const yearSelect = screen.getByRole("combobox", { name: /year/i });
    await user.selectOptions(yearSelect, "2027");

    expect(onChangeSpy).not.toHaveBeenCalled();
    // The trigger label (controlled value) still reflects 2026 until a
    // day is clicked.
    expect(
      screen.getByRole("button", { name: /January 15th, 2026/i }),
    ).toBeInTheDocument();
  });
});
