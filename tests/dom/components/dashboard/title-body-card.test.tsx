// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstPostCard } from "@/components/dashboard/module-cards";
import type { GeneratedAsset } from "@/lib/db/schema";

/**
 * FirstPostCard backs both "title-body" modules: first_post and perks_post.
 * Guards that the card titles and wires actions by the asset's own module,
 * and that a no-perks perks_post renders the skip notice instead of an
 * empty post.
 */

function asset(module: string, content: { title: string; body: string }): GeneratedAsset {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    packageId: "00000000-0000-0000-0000-000000000000",
    module: module as GeneratedAsset["module"],
    version: 1,
    content,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    editHistory: [],
    vaNotes: null,
    qualityScore: null,
    createdBy: "00000000-0000-0000-0000-000000000000",
    createdAt: new Date(),
  };
}

describe("FirstPostCard as perks_post", () => {
  test("filled perks post shows its label, title, body and wires actions to perks_post", async () => {
    const onAction = vi.fn();
    render(
      <FirstPostCard
        asset={asset("perks_post", { title: "Your perks 🎁", body: "Private podcast" })}
        onAction={onAction}
      />,
    );
    expect(screen.getByText("Perks Post")).toBeInTheDocument();
    expect(screen.getByText("Your perks 🎁")).toBeInTheDocument();
    expect(screen.getByText("Private podcast")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onAction).toHaveBeenCalledWith("perks_post", "regenerate");
  });

  test("empty perks post shows the no-perks notice and can still be approved", async () => {
    const onAction = vi.fn();
    render(
      <FirstPostCard asset={asset("perks_post", { title: "", body: "" })} onAction={onAction} />,
    );
    expect(
      screen.getByText(/No perks on the intake, so there's no perks post/),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
    expect(onAction).toHaveBeenCalledWith("perks_post", "approve");
  });
});

describe("FirstPostCard as first_post", () => {
  test("keeps the First Post label and wires actions to first_post", async () => {
    const onAction = vi.fn();
    render(
      <FirstPostCard
        asset={asset("first_post", { title: "Welcome!", body: "Say hi below." })}
        onAction={onAction}
      />,
    );
    expect(screen.getByText("First Post")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit" }));
    expect(onAction).toHaveBeenCalledWith("first_post", "edit");
  });
});
