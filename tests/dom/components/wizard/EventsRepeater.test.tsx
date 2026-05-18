// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import {
  EventsRepeater,
  makeDefaultMonthlySchedule,
  makeDefaultOneOffSchedule,
  makeDefaultYearlySchedule,
} from "@/components/wizard/EventsRepeater";
import type { CalendarEventIntake } from "@/types/schemas";

/**
 * Controlled harness so we can drive recurrence swaps through the values
 * prop. The Radix Select trigger doesn't play nicely with jsdom out of
 * the box (portals + pointer events), so this test asserts the contract
 * that matters: when `schedule.type` flips on a row, EventsRepeater
 * swaps the visible sub-form correctly.
 */
function Harness({ initial }: { initial: CalendarEventIntake[] }) {
  const [events, setEvents] = useState(initial);
  return <EventsRepeater values={events} onChange={setEvents} />;
}

const WEEKLY_EVENT: CalendarEventIntake = {
  title: "Weekly Q&A",
  schedule: {
    type: "weekly",
    dayOfWeek: "mon",
    time: "09:00",
    timezone: "America/New_York",
  },
};

describe("EventsRepeater recurrence sub-forms", () => {
  test("weekly schedule shows the day-of-week select and no other recurrence fields", () => {
    render(<Harness initial={[WEEKLY_EVENT]} />);
    expect(screen.getByLabelText(/Day of week/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Day of month/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Month$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Date$/i)).not.toBeInTheDocument();
  });

  test("monthly schedule shows day-of-month and the interval select", () => {
    render(
      <Harness
        initial={[
          { title: "Full Moon", schedule: makeDefaultMonthlySchedule() },
        ]}
      />,
    );
    expect(screen.getByLabelText(/Day of month/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/How often/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Day of week/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Month$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Date$/i)).not.toBeInTheDocument();
  });

  test("monthly with non-preset interval reveals the Custom number input", () => {
    render(
      <Harness
        initial={[
          {
            title: "Bi-monthly Mastermind",
            schedule: {
              type: "monthly",
              dayOfMonth: 1,
              interval: 2,
              time: "09:00",
              timezone: "UTC",
            },
          },
        ]}
      />,
    );
    expect(
      screen.getByLabelText(/Months between events/i),
    ).toBeInTheDocument();
  });

  test("monthly with interval=1 hides the Custom number input", () => {
    render(
      <Harness
        initial={[
          { title: "Monthly", schedule: makeDefaultMonthlySchedule() },
        ]}
      />,
    );
    expect(
      screen.queryByLabelText(/Months between events/i),
    ).not.toBeInTheDocument();
  });

  test("yearly schedule shows the month select + day-of-month", () => {
    render(
      <Harness
        initial={[
          { title: "Spring Equinox", schedule: makeDefaultYearlySchedule() },
        ]}
      />,
    );
    expect(screen.getByLabelText(/^Month$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Day of month/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Day of week/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Date$/i)).not.toBeInTheDocument();
  });

  test("one_off schedule shows the date input only", () => {
    render(
      <Harness
        initial={[
          { title: "Launch", schedule: makeDefaultOneOffSchedule() },
        ]}
      />,
    );
    expect(screen.getByLabelText(/^Date$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Day of week/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Day of month/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Month$/i)).not.toBeInTheDocument();
  });

  test("cadence preview renders the describeRecurrence phrase", () => {
    render(
      <Harness
        initial={[
          {
            title: "Quarterly Reset",
            schedule: {
              type: "monthly",
              dayOfMonth: 1,
              interval: 3,
              time: "09:00",
              timezone: "UTC",
            },
          },
        ]}
      />,
    );
    expect(
      screen.getByTestId("events-0-cadence-preview"),
    ).toHaveTextContent("The 1st, every 3 months (quarterly)");
  });
});
