// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ImageModuleCard,
  ImageVariantsCard,
} from "@/components/dashboard/module-cards";
import type { GeneratedAsset } from "@/lib/db/schema";

/**
 * DOM tests for the PR #7 image cards:
 *  - ImageVariantsCard — generalized cover/icon, fires onSelectVariant with
 *    the asset's module key + clicked index
 *  - ImageModuleCard — single-variant image (classroom_cover, calendar_cover)
 *
 * Card props mirror PR #6's pattern: narrow, dumb display + button wiring.
 */

function asset<T>(module: string, content: T): GeneratedAsset {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    packageId: "00000000-0000-0000-0000-000000000000",
    module: module as GeneratedAsset["module"],
    version: 1,
    content: content as object,
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

describe("ImageVariantsCard", () => {
  const variantsContent = {
    variants: [
      { url: "https://example.test/icon-1.png", index: 0 },
      { url: "https://example.test/icon-2.png", index: 1 },
      { url: "https://example.test/icon-3.png", index: 2 },
    ],
    selected_variant_index: 1,
  };

  test("renders all 3 variants for an icon asset", () => {
    render(
      <ImageVariantsCard
        asset={asset("icon", variantsContent)}
        onAction={vi.fn()}
        onSelectVariant={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Community Icon variant 1")).toBeInTheDocument();
    expect(screen.getByAltText("Community Icon variant 2")).toBeInTheDocument();
    expect(screen.getByAltText("Community Icon variant 3")).toBeInTheDocument();
  });

  test("clicking a variant fires onSelectVariant(module, index)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ImageVariantsCard
        asset={asset("icon", variantsContent)}
        onAction={vi.fn()}
        onSelectVariant={onSelect}
      />,
    );
    await user.click(screen.getByAltText("Community Icon variant 3"));
    expect(onSelect).toHaveBeenCalledWith("icon", 2);
  });

  test("disables variant buttons when no onSelectVariant is provided", () => {
    render(
      <ImageVariantsCard
        asset={asset("icon", variantsContent)}
        onAction={vi.fn()}
      />,
    );
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("img"));
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b).toBeDisabled();
    }
  });

  test("renders cover-module asset (alt text uses cover label)", () => {
    render(
      <ImageVariantsCard
        asset={asset("cover", variantsContent)}
        onAction={vi.fn()}
        onSelectVariant={vi.fn()}
      />,
    );
    expect(
      screen.getByAltText("Community Cover variant 1"),
    ).toBeInTheDocument();
  });
});

describe("ImageModuleCard", () => {
  test("renders the single variant image for classroom_cover", () => {
    render(
      <ImageModuleCard
        asset={asset("classroom_cover", {
          variants: [
            { url: "https://example.test/cc.png", index: 0 },
          ],
        })}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Classroom Cover")).toBeInTheDocument();
  });

  test("renders the single variant image for calendar_cover", () => {
    render(
      <ImageModuleCard
        asset={asset("calendar_cover", {
          variants: [{ url: "https://example.test/calc.png", index: 0 }],
        })}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Calendar Cover")).toBeInTheDocument();
  });

  test("approve button fires onAction with the asset's module key", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <ImageModuleCard
        asset={asset("classroom_cover", {
          variants: [{ url: "https://example.test/cc.png", index: 0 }],
        })}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(onAction).toHaveBeenCalledWith("classroom_cover", "approve");
  });
});
