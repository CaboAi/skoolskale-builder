// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Step2Offer } from "@/app/creators/new/steps/step-2";
import { CreatorIntakeSchema, type CreatorIntake } from "@/types/schemas";

/**
 * Step 2 DOM tests for the post-cleanup intake shape: no Courses field,
 * no Events field. Perks list + Guest sessions checkbox stay.
 */

const DEFAULTS: CreatorIntake = {
  name: "x",
  community_name: "x",
  niche: "other",
  audience: "x",
  transformation: "x",
  tone: "warm",
  offer_breakdown: { perks: [], guest_sessions: false },
  pricing: { additional_tiers: [] },
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
  return <Step2Offer form={form} />;
}

describe("Step2Offer", () => {
  test("renders Transformation, Audience, Perks, and Guest sessions", () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Transformation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Audience/i)).toBeInTheDocument();
    expect(screen.getByText(/^Perks$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Guest sessions \/ expert drop-ins/i),
    ).toBeInTheDocument();
  });

  test("does not render a Courses field (moved to classroom titles in step 5)", () => {
    render(<Harness />);
    expect(screen.queryByText(/^Courses$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add course/i }),
    ).not.toBeInTheDocument();
  });

  test("does not render an Events field (moved to calendar_intake.events in step 5)", () => {
    render(<Harness />);
    expect(screen.queryByText(/^Events$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add event\b/i }),
    ).not.toBeInTheDocument();
  });

  test("Add perk button appends a new row", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const addPerk = screen.getByRole("button", { name: /Add perk/i });
    await user.click(addPerk);
    const inputs = screen.getAllByPlaceholderText(
      /Private podcast, community Q&A/i,
    );
    expect(inputs).toHaveLength(1);
  });
});
