// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepeaterField } from "@/components/wizard/RepeaterField";

/**
 * RepeaterField is intentionally fixed-row (9 leaderboard levels per
 * LeaderboardContentSchema, 3 categories per CategoriesContentSchema).
 * No add/remove UI exists. These tests cover the actual behavior:
 * rendering N rows, propagating edits, surfacing per-row errors.
 */

describe("RepeaterField — single variant", () => {
  test("renders one input per value", () => {
    render(
      <RepeaterField
        variant="single"
        legend="Levels"
        rowLabel={(i) => `Level ${i + 1}`}
        values={["Newcomer", "Explorer", "Member"]}
        onChange={() => {}}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toHaveValue("Newcomer");
    expect(inputs[1]).toHaveValue("Explorer");
    expect(inputs[2]).toHaveValue("Member");
  });

  test("typing in a row fires onChange with the updated array", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RepeaterField
        variant="single"
        legend="Levels"
        rowLabel={(i) => `Level ${i + 1}`}
        values={["A", "B"]}
        onChange={onChange}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    // Append a single character; React re-renders each keystroke, so the
    // controlled value resets each time. Asserting the last call captures
    // what the user appended.
    await user.type(inputs[1], "X");
    expect(onChange).toHaveBeenLastCalledWith(["A", "BX"]);
  });

  test("renders per-row error text when provided", () => {
    render(
      <RepeaterField
        variant="single"
        legend="Levels"
        rowLabel={(i) => `Level ${i + 1}`}
        values={["A", ""]}
        onChange={() => {}}
        errors={[undefined, "Required"]}
      />,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  test("renders the legend", () => {
    render(
      <RepeaterField
        variant="single"
        legend="Leaderboard levels (9)"
        rowLabel={(i) => `Level ${i + 1}`}
        values={["a"]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Leaderboard levels (9)")).toBeInTheDocument();
  });
});

describe("RepeaterField — grouped variant", () => {
  const ROWS = [
    { name: "Intro", description: "say hi" },
    { name: "Wins", description: "share progress" },
    { name: "Advice", description: "tips" },
  ];

  test("renders name + description inputs per row", () => {
    render(
      <RepeaterField
        variant="grouped"
        legend="Categories (3)"
        rowLabel={(i) => `Category ${i + 1}`}
        values={ROWS}
        onChange={() => {}}
      />,
    );
    // 3 rows × (1 input + 1 textarea) = 6 textbox-roled controls.
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getByDisplayValue("Intro")).toBeInTheDocument();
    expect(screen.getByDisplayValue("share progress")).toBeInTheDocument();
  });

  test("editing the name input fires onChange with the right row updated", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RepeaterField
        variant="grouped"
        legend="Categories"
        rowLabel={(i) => `Category ${i + 1}`}
        values={ROWS}
        onChange={onChange}
      />,
    );
    const nameInput = screen.getByDisplayValue("Wins");
    await user.type(nameInput, "!");
    expect(onChange).toHaveBeenLastCalledWith([
      { name: "Intro", description: "say hi" },
      { name: "Wins!", description: "share progress" },
      { name: "Advice", description: "tips" },
    ]);
  });

  test("editing the description fires onChange with the right row updated", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RepeaterField
        variant="grouped"
        legend="Categories"
        rowLabel={(i) => `Category ${i + 1}`}
        values={ROWS}
        onChange={onChange}
      />,
    );
    const descTextarea = screen.getByDisplayValue("tips");
    await user.type(descTextarea, "!");
    expect(onChange).toHaveBeenLastCalledWith([
      { name: "Intro", description: "say hi" },
      { name: "Wins", description: "share progress" },
      { name: "Advice", description: "tips!" },
    ]);
  });

  test("renders per-row name and description errors independently", () => {
    render(
      <RepeaterField
        variant="grouped"
        legend="Categories"
        rowLabel={(i) => `Category ${i + 1}`}
        values={ROWS}
        onChange={() => {}}
        errors={[
          { name: "Name needed" },
          undefined,
          { description: "Desc needed" },
        ]}
      />,
    );
    expect(screen.getByText("Name needed")).toBeInTheDocument();
    expect(screen.getByText("Desc needed")).toBeInTheDocument();
  });
});
