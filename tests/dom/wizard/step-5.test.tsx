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
  trial_terms: { has_trial: false },
  refund_policy: "",
  support_contact: "x",
  brand_prefs: "",
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
    expect(screen.getByRole("heading", { name: /Classroom/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Calendar/i })).toBeInTheDocument();
    expect(screen.getByText(/Leaderboard levels \(9\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Categories \(3\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Discovery search keywords/i)).toBeInTheDocument();
  });

  test("classroom title and description inputs accept text and respect max length", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const title = screen.getByLabelText(/^Title.*max 50/i);
    const desc = screen.getByLabelText(/^Description.*max 500/i);
    await user.type(title, "The Welcome Course");
    await user.type(desc, "What you'll learn inside.");
    expect(title).toHaveValue("The Welcome Course");
    expect(desc).toHaveValue("What you'll learn inside.");
    // maxLength caps are HTML attributes — assert they were applied.
    expect(title).toHaveAttribute("maxLength", "50");
    expect(desc).toHaveAttribute("maxLength", "500");
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
