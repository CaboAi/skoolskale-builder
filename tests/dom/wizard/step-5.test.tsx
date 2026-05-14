// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Step5AddOns } from "@/app/creators/new/steps/step-5";
import { CreatorIntakeSchema, type CreatorIntake } from "@/types/schemas";

/**
 * Component-level tests for the wizard's add-on intake step. We don't mount
 * the full IntakeWizard — that's e2e territory and would pull in routing,
 * fetch mocks, and autosave timers. Instead we wrap Step5AddOns in a
 * minimal RHF form harness and assert the rendered shape and editing
 * behavior.
 */

const DEFAULTS: CreatorIntake = {
  name: "x",
  community_name: "x",
  niche: "other",
  audience: "x",
  transformation: "x",
  tone: "warm",
  offer_breakdown: { courses: [], perks: [], events: [], guest_sessions: false },
  pricing: { tiers: [] },
  trial_terms: { has_trial: false, duration_days: 7 },
  refund_policy: "",
  support_contact: "x",
  brand_prefs: "",
  classroom_titles: [""],
};

function Harness() {
  const form = useForm<CreatorIntake>({
    // Same cast the real wizard uses — see wizard.tsx comment.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreatorIntakeSchema) as any,
    defaultValues: DEFAULTS,
    mode: "onChange",
  });
  return <Step5AddOns form={form} />;
}

describe("Step5AddOns", () => {
  test("renders all five add-on sections", () => {
    render(<Harness />);
    expect(
      screen.getByRole("heading", { name: /Launch package add-ons/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Classroom titles/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Calendar/i })).toBeInTheDocument();
    expect(screen.getByText(/Leaderboard levels \(9\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Categories \(3\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Discovery search keywords/i)).toBeInTheDocument();
  });

  test("classroom titles repeater starts with one row capped at 50 chars", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const first = screen.getByLabelText(/Classroom 1/i);
    await user.type(first, "The Welcome Course");
    expect(first).toHaveValue("The Welcome Course");
    expect(first).toHaveAttribute("maxLength", "50");
  });

  test("Add classroom title button appends a new row up to 10", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const addButton = screen.getByRole("button", {
      name: /Add classroom title/i,
    });
    await user.click(addButton);
    expect(screen.getByLabelText(/Classroom 2/i)).toBeInTheDocument();
    // Click 8 more times to reach the cap (1 default + 1 + 8 = 10).
    for (let i = 0; i < 8; i++) {
      await user.click(addButton);
    }
    expect(screen.getByLabelText(/Classroom 10/i)).toBeInTheDocument();
    expect(addButton).toBeDisabled();
  });

  test("calendar title and description fields apply tighter caps (30/300)", () => {
    render(<Harness />);
    const title = screen.getByLabelText(/^Title.*max 30/i);
    const desc = screen.getByLabelText(/^Description.*max 300/i);
    expect(title).toHaveAttribute("maxLength", "30");
    expect(desc).toHaveAttribute("maxLength", "300");
  });

  test("leaderboard renders 9 rows prefilled with the canonical default names", () => {
    render(<Harness />);
    const expected = [
      "Newcomer",
      "Explorer",
      "Member",
      "Contributor",
      "Advocate",
      "Mentor",
      "Champion",
      "Leader",
      "Founder",
    ];
    for (const name of expected) {
      expect(screen.getByDisplayValue(name)).toBeInTheDocument();
    }
  });

  test("categories renders 3 rows prefilled with the canonical defaults", () => {
    render(<Harness />);
    expect(screen.getByDisplayValue("Introduce Yourself")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Share your wins")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Advice from the creator")).toBeInTheDocument();
  });

  test("editing a leaderboard row updates the displayed value", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const newcomer = screen.getByDisplayValue("Newcomer");
    await user.clear(newcomer);
    await user.type(newcomer, "Seedling");
    expect(newcomer).toHaveValue("Seedling");
  });

  test("editing a category description updates the displayed value", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const desc = screen.getByDisplayValue("Say hi and tell us a bit about you.");
    await user.clear(desc);
    await user.type(desc, "Welcome — introduce yourself!");
    expect(desc).toHaveValue("Welcome — introduce yourself!");
  });

  test("discovery keyword input accepts an Enter-committed chip", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText(/Discovery search keywords/i);
    await user.type(input, "yoga{Enter}");
    expect(screen.getByText("yoga")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });
});
