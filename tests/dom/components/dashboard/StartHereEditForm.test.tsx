// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartHereEditForm } from "@/components/dashboard/edit-forms/StartHereEditForm";
import type { StartHereOutput } from "@/prompts/start-here";

const VALID: StartHereOutput = {
  step_1_how_to_use: {
    title: "How to use Sanctuary",
    sections: [
      { name: "Community", description: "Drop a hello in #intros." },
      { name: "Classroom", description: "Start with the Foundations course." },
      { name: "Calendar", description: "Live calls Thursdays 11am PT." },
    ],
  },
  step_2_community_rules: {
    title: "House rules",
    rules: [
      "Be kind, even when you disagree.",
      "No DMs without consent.",
      "Spoilers behind cuts.",
    ],
  },
  step_3_faqs: [
    { question: "Where do I start?", answer_template: "Classroom > Start Here." },
    {
      question: "How often are live calls?",
      answer_template: "Weekly, Thursdays 11am PT, recorded.",
    },
    {
      question: "Can I change tiers?",
      answer_template: "Yes — message Ramsha.",
    },
    {
      question: "Refund policy?",
      answer_template: "14 days, no questions asked.",
    },
  ],
  step_4_need_assistance: {
    title: "Need anything?",
    template: "Message Ramsha for billing or support.",
  },
};

describe("StartHereEditForm", () => {
  test("initial render mirrors the passed data across all 4 sections", () => {
    render(
      <StartHereEditForm
        initial={VALID}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    // Step 1 title.
    expect(screen.getByLabelText(/^Title$/, { selector: "#step1-title" })).toHaveValue(
      "How to use Sanctuary",
    );
    // Step 1 first section name + description.
    expect(screen.getByDisplayValue("Community")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Drop a hello in #intros.")).toBeInTheDocument();

    // Step 2 first rule.
    expect(
      screen.getByDisplayValue("Be kind, even when you disagree."),
    ).toBeInTheDocument();

    // Step 3 first FAQ.
    expect(screen.getByDisplayValue("Where do I start?")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Classroom > Start Here."),
    ).toBeInTheDocument();

    // Step 4 title + template.
    expect(
      screen.getByLabelText(/^Title$/, { selector: "#step4-title" }),
    ).toHaveValue("Need anything?");
    expect(screen.getByLabelText(/Template/i)).toHaveValue(
      "Message Ramsha for billing or support.",
    );
  });

  test("Step 1 Add section adds a 4th; Remove brings back to 3", async () => {
    const user = userEvent.setup();
    render(
      <StartHereEditForm
        initial={VALID}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    const step1 = screen.getByText(/Step 1: How to use/).closest("fieldset")!;
    expect(within(step1).getByText(/3 of 10 sections/)).toBeInTheDocument();
    await user.click(within(step1).getByRole("button", { name: /Add section/i }));
    expect(within(step1).getByText(/4 of 10 sections/)).toBeInTheDocument();
    const removes = within(step1).getAllByRole("button", {
      name: /Remove section/i,
    });
    await user.click(removes[removes.length - 1]);
    expect(within(step1).getByText(/3 of 10 sections/)).toBeInTheDocument();
  });

  test("Step 2 Add rule disabled at MAX (10)", async () => {
    const big: StartHereOutput = {
      ...VALID,
      step_2_community_rules: {
        title: "x".repeat(5),
        rules: Array.from({ length: 10 }, (_, i) => `rule ${i}`),
      },
    };
    render(
      <StartHereEditForm
        initial={big}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    const step2 = screen
      .getByText(/Step 2: Community rules/)
      .closest("fieldset")!;
    expect(within(step2).getByRole("button", { name: /Add rule/i })).toBeDisabled();
  });

  test("Step 3 Remove FAQ disabled at MIN (4)", () => {
    render(
      <StartHereEditForm
        initial={VALID}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    const step3 = screen.getByText(/Step 3: FAQs/).closest("fieldset")!;
    for (const btn of within(step3).getAllByRole("button", {
      name: /Remove FAQ/i,
    })) {
      expect(btn).toBeDisabled();
    }
  });

  test("Save with valid data fires onSave with the structured 4-step payload", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StartHereEditForm
        initial={VALID}
        onSave={onSave}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.step_1_how_to_use.title).toBe("How to use Sanctuary");
    expect(payload.step_2_community_rules.rules).toHaveLength(3);
    expect(payload.step_3_faqs).toHaveLength(4);
    expect(payload.step_4_need_assistance.template).toMatch(/Ramsha/);
  });

  test("Save with empty step_1 title surfaces validation, does NOT call onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StartHereEditForm
        initial={{
          ...VALID,
          step_1_how_to_use: { ...VALID.step_1_how_to_use, title: "" },
        }}
        onSave={onSave}
        onCancel={() => {}}
        saving={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(onSave).not.toHaveBeenCalled();
    const titleInput = screen.getByLabelText(/^Title$/, {
      selector: "#step1-title",
    });
    expect(titleInput).toHaveAttribute("aria-invalid", "true");
  });

  test("Cancel fires onCancel without firing onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <StartHereEditForm
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

  test("graceful render: missing nested arrays still mount the form", () => {
    const partial = {
      step_4_need_assistance: { title: "x", template: "y".repeat(10) },
    } as Partial<StartHereOutput>;
    render(
      <StartHereEditForm
        initial={partial}
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
      />,
    );
    // Each step section is still rendered with its placeholder defaults.
    expect(screen.getByText(/Step 1: How to use/)).toBeInTheDocument();
    expect(screen.getByText(/Step 2: Community rules/)).toBeInTheDocument();
    expect(screen.getByText(/Step 3: FAQs/)).toBeInTheDocument();
    expect(screen.getByText(/Step 4: Need assistance/)).toBeInTheDocument();
  });
});
