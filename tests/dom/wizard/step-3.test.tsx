// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Step3Pricing } from "@/app/creators/new/steps/step-3";
import { CreatorIntakeSchema, type CreatorIntake } from "@/types/schemas";

/**
 * Step 3 DOM tests for the locked Premium/VIP tier UI:
 *  - No tier-name input (rendered as a static label)
 *  - Add button label tracks the next slot ("Add Premium tier", then
 *    "Add VIP tier", then hidden)
 *  - Cap is 2 additional tiers
 *  - Cascade-remove: removing Premium also drops VIP
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

function Harness(props: { defaults?: CreatorIntake }) {
  const form = useForm<CreatorIntake>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreatorIntakeSchema) as any,
    defaultValues: props.defaults ?? DEFAULTS,
    mode: "onChange",
  });
  return <Step3Pricing form={form} />;
}

describe("Step3Pricing — additional tiers", () => {
  test("starts with zero tiers and shows an 'Add Premium tier' button", () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: /Add Premium tier/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add VIP tier/i }),
    ).not.toBeInTheDocument();
    // No tier-name input is ever rendered.
    expect(
      screen.queryByPlaceholderText(/Tier name/i),
    ).not.toBeInTheDocument();
  });

  test("clicking 'Add Premium tier' shows a Premium row with a price input and a Remove button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: /Add Premium tier/i }),
    );
    expect(screen.getByLabelText(/Premium tier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Premium price/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Remove/i }),
    ).toBeInTheDocument();
    // Add button now offers VIP, not Premium.
    expect(
      screen.getByRole("button", { name: /Add VIP tier/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add Premium tier/i }),
    ).not.toBeInTheDocument();
  });

  test("clicking 'Add VIP tier' surfaces a second locked row and hides the Add button at the cap of 2", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Add Premium tier/i }));
    await user.click(screen.getByRole("button", { name: /Add VIP tier/i }));
    expect(screen.getByLabelText(/Premium tier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/VIP tier/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add Premium tier/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add VIP tier/i }),
    ).not.toBeInTheDocument();
  });

  test("removing Premium when both tiers exist cascade-removes VIP", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        defaults={{
          ...DEFAULTS,
          pricing: {
            additional_tiers: [
              { name: "Premium", price: "$99" },
              { name: "VIP", price: "$299" },
            ],
          },
        }}
      />,
    );
    expect(screen.getByLabelText(/Premium tier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/VIP tier/i)).toBeInTheDocument();
    // Two Remove buttons; the first is Premium's, by render order.
    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    await user.click(removeButtons[0]);
    expect(screen.queryByLabelText(/Premium tier/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/VIP tier/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Premium tier/i }),
    ).toBeInTheDocument();
  });

  test("removing VIP alone drops VIP and re-exposes 'Add VIP tier'", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        defaults={{
          ...DEFAULTS,
          pricing: {
            additional_tiers: [
              { name: "Premium", price: "$99" },
              { name: "VIP", price: "$299" },
            ],
          },
        }}
      />,
    );
    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    await user.click(removeButtons[1]);
    expect(screen.getByLabelText(/Premium tier/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/VIP tier/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add VIP tier/i }),
    ).toBeInTheDocument();
  });
});
