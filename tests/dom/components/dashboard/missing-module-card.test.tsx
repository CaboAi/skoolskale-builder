// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MissingModuleCard } from "@/components/dashboard/module-cards";

/**
 * A module with no asset after generation (package predates the module, or
 * its job failed) must offer a way out instead of an endless skeleton.
 */
describe("MissingModuleCard", () => {
  test("shows the module label and fires onGenerate with that module", async () => {
    const onGenerate = vi.fn();
    render(<MissingModuleCard module="perks_post" onGenerate={onGenerate} />);
    expect(screen.getByText("Perks Post")).toBeInTheDocument();
    expect(
      screen.getByText("Not generated for this package yet."),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Generate" }));
    expect(onGenerate).toHaveBeenCalledWith("perks_post");
  });

  test("disables the button while the generate request is in flight", () => {
    render(
      <MissingModuleCard module="perks_post" onGenerate={() => {}} pending />,
    );
    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
  });
});
