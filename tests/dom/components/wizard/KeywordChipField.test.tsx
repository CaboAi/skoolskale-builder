// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordChipField } from "@/components/wizard/KeywordChipField";

/**
 * KeywordChipField component-level coverage. The pure add/remove/dedupe
 * rules are unit-tested in tests/unit/wizard/keyword-chip-logic.test.ts;
 * this file covers the keyboard wiring and DOM affordances that the unit
 * tests can't see.
 */

/** Stateful wrapper so the controlled component sees React state updates. */
function Harness({
  initial = [] as string[],
  max,
  onChangeSpy,
}: {
  initial?: string[];
  max?: number;
  onChangeSpy?: (next: string[]) => void;
}) {
  const [values, setValues] = useState<string[]>(initial);
  return (
    <KeywordChipField
      id="kw"
      label="Keywords"
      values={values}
      onChange={(next) => {
        setValues(next);
        onChangeSpy?.(next);
      }}
      max={max}
    />
  );
}

describe("KeywordChipField", () => {
  test("renders with no chips and an empty input", () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Keywords/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // Empty state shows the (0/11) counter on the label.
    expect(screen.getByText(/\(0\/11\)/)).toBeInTheDocument();
  });

  test("Enter commits a chip", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    const input = screen.getByLabelText(/Keywords/);
    await user.type(input, "yoga{Enter}");
    expect(spy).toHaveBeenLastCalledWith(["yoga"]);
    expect(screen.getByText("yoga")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  test("comma also commits a chip", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    const input = screen.getByLabelText(/Keywords/);
    await user.type(input, "mindfulness,");
    expect(spy).toHaveBeenLastCalledWith(["mindfulness"]);
    expect(screen.getByText("mindfulness")).toBeInTheDocument();
  });

  test("X button removes the matching chip", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={["yoga", "breathwork"]} onChangeSpy={spy} />);
    await user.click(screen.getByLabelText("Remove yoga"));
    expect(spy).toHaveBeenLastCalledWith(["breathwork"]);
    expect(screen.queryByText("yoga")).not.toBeInTheDocument();
    expect(screen.getByText("breathwork")).toBeInTheDocument();
  });

  test("Backspace on empty input removes the trailing chip", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={["yoga", "breathwork"]} onChangeSpy={spy} />);
    const input = screen.getByLabelText(/Keywords/);
    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(spy).toHaveBeenLastCalledWith(["yoga"]);
  });

  test("max enforcement blocks the 12th keyword (default max=11)", async () => {
    const user = userEvent.setup();
    const eleven = Array.from({ length: 11 }, (_, i) => `kw${i}`);
    const spy = vi.fn();
    render(<Harness initial={eleven} onChangeSpy={spy} />);
    const input = screen.getByLabelText(/Keywords/);
    await user.type(input, "twelfth{Enter}");
    // The commit handler short-circuits at max — onChange never fires
    // with a 12-length array.
    expect(spy).not.toHaveBeenCalled();
    // Input is also disabled when at-max with empty draft.
    expect(input).toBeDisabled();
  });

  test("dedupe — same keyword does not double-add", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={["yoga"]} onChangeSpy={spy} />);
    const input = screen.getByLabelText(/Keywords/);
    await user.type(input, "yoga{Enter}");
    expect(spy).not.toHaveBeenCalled();
    // The duplicate input should still clear so the user can type the next one.
    expect(input).toHaveValue("");
    // Still exactly one chip rendered.
    expect(screen.getAllByText("yoga")).toHaveLength(1);
  });

  test("custom max is respected", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={["a", "b"]} max={3} onChangeSpy={spy} />);
    const input = screen.getByLabelText(/Keywords/);
    await user.type(input, "c{Enter}");
    expect(spy).toHaveBeenLastCalledWith(["a", "b", "c"]);
    spy.mockClear();
    // 4th should be blocked.
    await user.type(input, "d{Enter}");
    expect(spy).not.toHaveBeenCalled();
  });
});
