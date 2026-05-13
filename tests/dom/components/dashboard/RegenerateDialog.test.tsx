// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegenerateDialog } from "@/components/dashboard/action-dialogs";

/**
 * Regression test for the dialog state leak: opening Regenerate on Module A,
 * typing a note, submitting (parent forces open=false), then opening for
 * Module B used to inherit Module A's note because Radix's onOpenChange does
 * not fire when the parent forces open=false by prop. Keying the dialog by
 * module at the call site (PackageDashboard) remounts it fresh per open.
 */

function Harness() {
  const [module, setModule] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setModule("classroom_cover")}>
        open A
      </button>
      <button type="button" onClick={() => setModule("cover")}>
        open B
      </button>
      <RegenerateDialog
        key={module ?? "closed"}
        open={module !== null}
        module={module}
        onOpenChange={(open) => {
          if (!open) setModule(null);
        }}
        // Simulates the parent's onSuccess path: force-close by setting
        // the dialog state to null (does NOT call onOpenChange).
        onConfirm={() => setModule(null)}
        isPending={false}
      />
    </>
  );
}

describe("RegenerateDialog", () => {
  test("note resets when reopening for a different module after submit", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "open A" }));
    const textareaA = await screen.findByLabelText(
      /What would you like changed/i,
    );
    await user.type(textareaA, "make it brighter");
    expect(textareaA).toHaveValue("make it brighter");

    // Submit path (parent force-closes the dialog).
    await user.click(screen.getByRole("button", { name: /^Regenerate$/ }));

    await user.click(screen.getByRole("button", { name: "open B" }));
    const textareaB = await screen.findByLabelText(
      /What would you like changed/i,
    );
    expect(textareaB).toHaveValue("");
  });
});
