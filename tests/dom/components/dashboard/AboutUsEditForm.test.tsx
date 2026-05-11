// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AboutUsEditForm } from "@/components/dashboard/edit-forms/AboutUsEditForm";
import type { AboutUsOutput } from "@/prompts/about-us";

const VALID: AboutUsOutput = {
  hero: "Reclaim your spiritual sovereignty inside Sanctuary.",
  trial_callout: "7-day trial, no credit card.",
  value_buckets: [
    { emoji: "✨", header: "COURSES", items: ["Foundations", "Embodiment"] },
    { emoji: "💫", header: "COACHING", items: ["Weekly Q&A", "1:1 once/qtr"] },
    {
      emoji: "🌙",
      header: "RITUAL",
      items: ["Full moon circle", "New moon intention"],
    },
  ],
  pricing: "$47/mo or $470/yr (save 2 months).",
  refund_policy: "14-day no-questions-asked refund.",
};

describe("AboutUsEditForm", () => {
  test("initial render mirrors the passed data on each tab", async () => {
    const user = userEvent.setup();
    render(
      <AboutUsEditForm
        initial={VALID}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );

    // Hero tab is the default.
    expect(screen.getByRole("textbox", { name: /^Hero$/ })).toHaveValue(VALID.hero);
    expect(screen.getByLabelText(/Trial callout/i)).toHaveValue(
      VALID.trial_callout,
    );

    // Value buckets tab.
    await user.click(screen.getByRole("tab", { name: /Value Buckets/i }));
    expect(
      screen.getByText(`${VALID.value_buckets.length} of 6 buckets (min 3)`),
    ).toBeInTheDocument();
    // First bucket's header rendered.
    expect(screen.getByDisplayValue("COURSES")).toBeInTheDocument();
    // First bucket's first item rendered.
    expect(screen.getByDisplayValue("Foundations")).toBeInTheDocument();

    // Pricing tab.
    await user.click(screen.getByRole("tab", { name: /Pricing/i }));
    expect(screen.getByLabelText(/Pricing line/i)).toHaveValue(VALID.pricing);

    // Refund tab.
    await user.click(screen.getByRole("tab", { name: /Refund/i }));
    expect(screen.getByLabelText(/Refund policy/i)).toHaveValue(
      VALID.refund_policy,
    );
  });

  test("Add bucket adds a 4th bucket; Remove bucket on the 4th brings it back to 3", async () => {
    const user = userEvent.setup();
    render(
      <AboutUsEditForm
        initial={VALID}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Value Buckets/i }));

    await user.click(screen.getByRole("button", { name: /Add bucket/i }));
    expect(screen.getByText(/4 of 6 buckets/)).toBeInTheDocument();

    // Remove the 4th (newest) bucket.
    const removeButtons = screen.getAllByRole("button", {
      name: /Remove bucket/i,
    });
    await user.click(removeButtons[removeButtons.length - 1]);
    expect(screen.getByText(/3 of 6 buckets/)).toBeInTheDocument();
  });

  test("Add bucket disabled at MAX (6)", async () => {
    const user = userEvent.setup();
    const six: AboutUsOutput = {
      ...VALID,
      value_buckets: Array.from({ length: 6 }, (_, i) => ({
        emoji: "x",
        header: `H${i}`,
        items: ["a", "b"],
      })),
    };
    render(
      <AboutUsEditForm
        initial={six}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Value Buckets/i }));
    expect(
      screen.getByRole("button", { name: /Add bucket/i }),
    ).toBeDisabled();
  });

  test("Remove bucket disabled at MIN (3)", async () => {
    const user = userEvent.setup();
    render(
      <AboutUsEditForm
        initial={VALID}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Value Buckets/i }));
    for (const btn of screen.getAllByRole("button", {
      name: /Remove bucket/i,
    })) {
      expect(btn).toBeDisabled();
    }
  });

  test("Save with valid data fires onSave with the structured payload", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <AboutUsEditForm
        initial={VALID}
        onSave={onSave}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      hero: VALID.hero,
      trial_callout: VALID.trial_callout,
      pricing: VALID.pricing,
      refund_policy: VALID.refund_policy,
    });
    expect(onSave.mock.calls[0][0].value_buckets).toHaveLength(3);
  });

  test("Save with empty hero surfaces inline validation, does NOT call onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <AboutUsEditForm
        initial={{ ...VALID, hero: "" }}
        onSave={onSave}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(onSave).not.toHaveBeenCalled();
    // Hero tab content stays mounted; the inline error text should appear.
    const heroField = screen.getByRole("textbox", { name: /^Hero$/ });
    expect(heroField).toHaveAttribute("aria-invalid", "true");
  });

  test("Cancel fires onCancel without firing onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <AboutUsEditForm
        initial={VALID}
        onSave={onSave}
        onCancel={onCancel}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  test("graceful render: malformed (missing value_buckets) initial data still mounts", () => {
    const partial = {
      hero: "x".repeat(20),
      trial_callout: "y".repeat(10),
      pricing: "z".repeat(10),
      refund_policy: "w".repeat(10),
    } as Partial<AboutUsOutput>;
    render(
      <AboutUsEditForm
        initial={partial}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    // Did not throw; the form rendered the hero tab with the partial data.
    expect(screen.getByRole("textbox", { name: /^Hero$/ })).toBeInTheDocument();
  });

  test("BucketEditor: Add item to first bucket reaches 3 items", async () => {
    const user = userEvent.setup();
    render(
      <AboutUsEditForm
        initial={VALID}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Value Buckets/i }));
    // First bucket starts with 2 items.
    const firstBucket = screen.getByDisplayValue("COURSES").closest(
      ".rounded-md",
    ) as HTMLElement;
    const addItemBtn = within(firstBucket).getByRole("button", {
      name: /Add item/i,
    });
    await user.click(addItemBtn);
    expect(
      within(firstBucket).getByText(/Items \(3 of 8, min 2\)/),
    ).toBeInTheDocument();
  });
});
