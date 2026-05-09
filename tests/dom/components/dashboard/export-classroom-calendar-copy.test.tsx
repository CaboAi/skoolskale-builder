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
  content: { title: string; description: string },
): GeneratedAsset {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    packageId: "00000000-0000-0000-0000-000000000000",
    module: module as GeneratedAsset["module"],
    version: 1,
    content: content as object,
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

describe("ClassroomSection — independent title + description copy", () => {
  const sample = {
    title: "The Welcome Course",
    description: "Where to start.",
  };

  test("renders two copy buttons (no Copy both)", () => {
    render(<ClassroomSection asset={asset("classroom", sample)} />);
    expect(screen.getByRole("button", { name: /copy title/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy description/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy both/i }),
    ).not.toBeInTheDocument();
  });

  test("Copy title writes only the title to the clipboard", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<ClassroomSection asset={asset("classroom", sample)} />);
    await user.click(screen.getByRole("button", { name: /copy title/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("The Welcome Course");
  });

  test("Copy description writes only the description to the clipboard", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<ClassroomSection asset={asset("classroom", sample)} />);
    await user.click(screen.getByRole("button", { name: /copy description/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Where to start.");
  });
});

describe("CalendarSection — independent title + description copy", () => {
  const sample = {
    title: "Weekly Cadence",
    description: "Live calls every Thursday.",
  };

  test("renders two copy buttons (no Copy both)", () => {
    render(<CalendarSection asset={asset("calendar", sample)} />);
    expect(screen.getByRole("button", { name: /copy title/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy description/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy both/i }),
    ).not.toBeInTheDocument();
  });

  test("Copy title writes only the title to the clipboard", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<CalendarSection asset={asset("calendar", sample)} />);
    await user.click(screen.getByRole("button", { name: /copy title/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Weekly Cadence");
  });

  test("Copy description writes only the description to the clipboard", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    render(<CalendarSection asset={asset("calendar", sample)} />);
    await user.click(screen.getByRole("button", { name: /copy description/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("Live calls every Thursday.");
  });
});
