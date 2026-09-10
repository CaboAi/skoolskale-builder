// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AboutUsEditForm } from "@/components/dashboard/edit-forms/AboutUsEditForm";
import {
  ABOUT_US_MAX_CHARS,
  type AboutUsOutput,
} from "@/prompts/about-us";

// New (post-Skool-cap-fix) shape: at most 3 buckets, exactly one item
// per bucket. Rendered length ~340 chars, well under the 1,050 cap.
const VALID: AboutUsOutput = {
  hero: "Reclaim your spiritual sovereignty inside Sanctuary.",
  trial_callout: "7-day trial, no credit card.",
  value_buckets: [
    {
      emoji: "✨",
      header: "COURSES",
      items: ["Foundations + Embodiment modules go at your pace."],
    },
    {
      emoji: "💫",
      header: "COACHING",
      items: ["Weekly group Q&A and one 1:1 per quarter."],
    },
    {
      emoji: "🌙",
      header: "RITUAL",
      items: ["Full moon circle + new moon intention every month."],
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

    // Value buckets tab — new limits: max 3, min 1.
    await user.click(screen.getByRole("tab", { name: /Value Buckets/i }));
    expect(
      screen.getByText(`${VALID.value_buckets.length} of 3 buckets (min 1)`),
    ).toBeInTheDocument();
    // First bucket's header rendered.
    expect(screen.getByDisplayValue("COURSES")).toBeInTheDocument();
    // First bucket's item rendered.
    expect(
      screen.getByDisplayValue(VALID.value_buckets[0].items[0]),
    ).toBeInTheDocument();

    // Pricing tab.
    await user.click(screen.getByRole("tab", { name: /Pricing/i }));
    expect(screen.getByLabelText(/Pricing line/i)).toHaveValue(VALID.pricing);

    // Refund tab.
    await user.click(screen.getByRole("tab", { name: /Refund/i }));
    expect(screen.getByLabelText(/Refund policy/i)).toHaveValue(
      VALID.refund_policy,
    );
  });

  test("Add bucket disabled at MAX (3)", async () => {
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
    expect(
      screen.getByRole("button", { name: /Add bucket/i }),
    ).toBeDisabled();
  });

  test("Remove bucket is allowed down to MIN (1)", async () => {
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
    const removeButtons = screen.getAllByRole("button", {
      name: /Remove bucket/i,
    });
    // All 3 enabled because min is 1 — removing 2 of 3 still leaves 1.
    for (const btn of removeButtons) {
      expect(btn).not.toBeDisabled();
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
    expect(screen.getByRole("textbox", { name: /^Hero$/ })).toBeInTheDocument();
  });

  test("BucketEditor: Add item is disabled (one line per bucket)", async () => {
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
    const firstBucket = screen.getByDisplayValue("COURSES").closest(
      ".rounded-md",
    ) as HTMLElement;
    expect(
      within(firstBucket).getByText(/Items \(1 of 1, min 1\)/),
    ).toBeInTheDocument();
    expect(
      within(firstBucket).getByRole("button", { name: /Add item/i }),
    ).toBeDisabled();
  });

  test("char counter renders and Save is gated when rendered text exceeds the Skool cap", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // Pad fields so the renderer overshoots the cap.
    const oversized: AboutUsOutput = {
      ...VALID,
      hero: "a".repeat(240),
      trial_callout: "b".repeat(160),
      value_buckets: [
        { emoji: "💜", header: "C", items: ["c".repeat(140)] },
        { emoji: "💜", header: "D", items: ["d".repeat(140)] },
        { emoji: "💜", header: "E", items: ["e".repeat(140)] },
      ],
      pricing: "f".repeat(160),
      refund_policy: "g".repeat(220),
    };
    render(
      <AboutUsEditForm
        initial={oversized}
        onSave={onSave}
        onCancel={() => {}}
        saving={false}
      />,
    );

    expect(
      screen.getByText(new RegExp(`/ ${ABOUT_US_MAX_CHARS} chars`)),
    ).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: /^Save$/i });
    expect(saveBtn).toBeDisabled();
    await user.click(saveBtn);
    expect(onSave).not.toHaveBeenCalled();
  });
});
