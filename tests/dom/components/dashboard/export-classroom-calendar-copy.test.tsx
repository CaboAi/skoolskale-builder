// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CalendarSection,
  ClassroomSection,
} from "@/components/dashboard/ExportView";
import type { GeneratedAsset } from "@/lib/db/schema";

/**
 * DOM tests for the per-field copy buttons on the Classroom and Calendar
 * ExportView sections. PR splits the prior single "Copy both" button into
 * two ("Copy title" + "Copy description") so VAs can paste each value
 * into the appropriate Skool field independently.
 *
 * About Us and Start Here keep their existing copy patterns and are not
 * exercised here.
 */

function asset(
  module: "classroom" | "calendar",
  content: object,
): GeneratedAsset {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    packageId: "00000000-0000-0000-0000-000000000000",
    module: module as GeneratedAsset["module"],
    version: 1,
    content,
    approved: true,
    approvedBy: null,
    approvedAt: null,
    editHistory: [],
    vaNotes: null,
    qualityScore: null,
    createdBy: "00000000-0000-0000-0000-000000000000",
    createdAt: new Date(),
  };
}

// CopyButton calls navigator.clipboard.writeText(text) directly. Tests
// install the spy via installClipboardSpy() AFTER userEvent.setup() —
// userEvent always replaces navigator.clipboard regardless of the
// writeToClipboard option, so installing earlier (e.g., in beforeEach)
// gets shadowed.
const writeText = vi.fn(async () => undefined);

function installClipboardSpy() {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    writable: true,
    value: {
      writeText,
      readText: vi.fn(async () => ""),
    },
  });
}

beforeEach(() => {
  writeText.mockClear();
});

describe("ClassroomSection — per-item title + description copy", () => {
  const sample = {
    items: [
      { title: "The Welcome Course", description: "Where to start." },
      { title: "Foundations", description: "Build the base." },
    ],
  };

  test("renders one Copy title + one Copy description per item", () => {
    render(<ClassroomSection asset={asset("classroom", sample)} />);
    expect(
      screen.getAllByRole("button", { name: /copy title/i }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /copy description/i }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /copy both/i }),
    ).not.toBeInTheDocument();
  });

  test("clicking the first Copy title writes the first item's title", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<ClassroomSection asset={asset("classroom", sample)} />);
    const titleBtns = screen.getAllByRole("button", { name: /copy title/i });
    await user.click(titleBtns[0]);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("The Welcome Course");
  });

  test("clicking the second Copy description writes the second item's description", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<ClassroomSection asset={asset("classroom", sample)} />);
    const descBtns = screen.getAllByRole("button", {
      name: /copy description/i,
    });
    await user.click(descBtns[1]);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Build the base.");
  });
});

describe("CalendarSection — per-event title + schedule + description copy", () => {
  const sample = {
    events: [
      {
        title: "Weekly Q&A",
        description: "Live calls every Thursday.",
        schedule: {
          type: "weekly" as const,
          dayOfWeek: "thu" as const,
          time: "11:00",
          timezone: "America/Los_Angeles",
        },
      },
      {
        title: "Launch Workshop",
        description: "Walkthrough.",
        schedule: {
          type: "one_off" as const,
          date: "2026-08-08",
          time: "09:00",
          timezone: "America/New_York",
        },
      },
    ],
  };

  test("renders Copy title, Copy schedule, and Copy description per event", () => {
    render(<CalendarSection asset={asset("calendar", sample)} />);
    expect(
      screen.getAllByRole("button", { name: /copy title/i }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /copy schedule/i }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /copy description/i }),
    ).toHaveLength(2);
  });

  test("clicking the first Copy title writes that event's title", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<CalendarSection asset={asset("calendar", sample)} />);
    await user.click(
      screen.getAllByRole("button", { name: /copy title/i })[0],
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Weekly Q&A");
  });

  test("clicking the second Copy schedule writes the formatted one_off string", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<CalendarSection asset={asset("calendar", sample)} />);
    await user.click(
      screen.getAllByRole("button", { name: /copy schedule/i })[1],
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^August 8, 2026 at 9:00 AM/),
    );
  });

  test("Copy description writes the event's description", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<CalendarSection asset={asset("calendar", sample)} />);
    await user.click(
      screen.getAllByRole("button", { name: /copy description/i })[0],
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Live calls every Thursday.");
  });
});
