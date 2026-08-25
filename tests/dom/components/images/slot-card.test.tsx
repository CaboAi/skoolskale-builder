// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotCard } from "@/components/images/SlotCard";
import { planSlots } from "@/lib/images/slots";
import type { ImageAssetSummary } from "@/components/images/types";

const PKG_ID = "pkg-1";

const PLAN = planSlots({
  communityName: "The Calm Closer",
  classroomTitles: ["Foundations", "The Reset"],
  calendarTitles: [],
});

const SLOT = PLAN.auto.find((s) => s.key === "classroom_cover:0")!;

function asset(overrides: Partial<ImageAssetSummary> = {}): ImageAssetSummary {
  return {
    id: "asset-1",
    slotKey: SLOT.key,
    slotKind: SLOT.kind,
    slotIndex: SLOT.index,
    slotTitle: SLOT.titleText,
    status: "done",
    version: 1,
    width: 1456,
    height: 816,
    error: null,
    createdAt: new Date().toISOString(),
    url: "https://example.test/signed.png",
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof SlotCard>[0]> = {}) {
  const onRegenerate = vi.fn();
  render(
    <SlotCard
      packageId={PKG_ID}
      slot={SLOT}
      pending={false}
      runActive={false}
      regenerating={false}
      onRegenerate={onRegenerate}
      {...props}
    />,
  );
  return { onRegenerate };
}

describe("SlotCard", () => {
  test("shows the target dimensions so a VA can confirm the Skool spec", () => {
    renderCard({ asset: asset() });
    expect(screen.getByText(/1456×816/)).toBeInTheDocument();
  });

  test("renders the generated image with the slot label as alt text", () => {
    renderCard({ asset: asset() });
    const img = screen.getByRole("img", { name: SLOT.label });
    expect(img).toBeInTheDocument();
  });

  test("a download link is offered only once an image exists", () => {
    const { unmount } = render(
      <SlotCard
        packageId={PKG_ID}
        slot={SLOT}
        pending={false}
        runActive={false}
        regenerating={false}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    unmount();

    renderCard({ asset: asset() });
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/api/packages/${PKG_ID}/images/classroom_cover/0/download`,
    );
  });

  test("a failed asset shows the provider error rather than a blank tile", () => {
    renderCard({
      asset: asset({ status: "failed", url: null, error: "provider exploded" }),
    });

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/provider exploded/)).toBeInTheDocument();
  });

  test("flags title drift when the DNA title changed after generation", () => {
    renderCard({ asset: asset({ slotTitle: "Old Title" }) });
    expect(screen.getByText(/Title changed since this was generated/)).toBeInTheDocument();
  });

  test("no drift warning when the stored title still matches", () => {
    renderCard({ asset: asset() });
    expect(screen.queryByText(/Title changed/)).toBeNull();
  });

  test("regenerate forwards the note from the dialog", async () => {
    const user = userEvent.setup();
    const { onRegenerate } = renderCard({ asset: asset() });

    await user.click(screen.getByRole("button", { name: /regenerate/i }));
    await user.type(
      screen.getByPlaceholderText(/darker background/i),
      "less text weight",
    );
    await user.click(screen.getByRole("button", { name: /^start$/i }));

    expect(onRegenerate).toHaveBeenCalledWith(SLOT, "less text weight");
  });

  test("an empty note is passed as undefined, not an empty string", async () => {
    const user = userEvent.setup();
    const { onRegenerate } = renderCard({ asset: asset() });

    await user.click(screen.getByRole("button", { name: /regenerate/i }));
    await user.click(screen.getByRole("button", { name: /^start$/i }));

    expect(onRegenerate).toHaveBeenCalledWith(SLOT, undefined);
  });

  test("actions are disabled while a run is active", () => {
    renderCard({ asset: asset(), runActive: true });
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeDisabled();
  });

  test("a pending slot shows the generating state instead of the image", () => {
    renderCard({ pending: true });
    expect(screen.getByText("Generating…")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("an ungenerated slot offers Generate rather than Regenerate", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
    expect(screen.getByText("Not generated")).toBeInTheDocument();
  });
});
