// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CategoriesCard,
  DiscoverySeoCard,
  LeaderboardCard,
  TextModuleCard,
} from "@/components/dashboard/module-cards";
import type { GeneratedAsset } from "@/lib/db/schema";

/**
 * DOM tests for the 4 new card surfaces introduced in PR #6:
 *  - TextModuleCard's classroom/calendar branch (title + description shape)
 *  - LeaderboardCard
 *  - CategoriesCard
 *  - DiscoverySeoCard
 *
 * Card props are intentionally narrow — the cards are dumb display + button
 * wiring; the registry-driven dispatch and the action mutations are exercised
 * elsewhere. These tests just guard that the card renders the right shape and
 * that the footer buttons fire onAction with the right module/action pair.
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

describe("TextModuleCard (classroom branch)", () => {
  test("renders every item's title and description for classroom shape", () => {
    render(
      <TextModuleCard
        asset={asset("classroom", {
          items: [
            { title: "The Welcome Course", description: "Where to start." },
            { title: "Foundations", description: "Build the base." },
          ],
        })}
        onAction={() => {}}
      />,
    );
    expect(screen.getByText("The Welcome Course")).toBeInTheDocument();
    expect(screen.getByText("Where to start.")).toBeInTheDocument();
    expect(screen.getByText("Foundations")).toBeInTheDocument();
    expect(screen.getByText("Build the base.")).toBeInTheDocument();
  });

  test("renders each event's title, description, and formatted schedule", () => {
    render(
      <TextModuleCard
        asset={asset("calendar", {
          events: [
            {
              title: "Weekly Q&A",
              description: "Live questions, real answers.",
              schedule: {
                type: "weekly",
                dayOfWeek: "thu",
                time: "11:00",
                timezone: "America/Los_Angeles",
              },
            },
            {
              title: "Launch Workshop",
              description: "Walkthrough.",
              schedule: {
                type: "one_off",
                date: "2026-08-08",
                time: "09:00",
                timezone: "America/New_York",
              },
            },
          ],
        })}
        onAction={() => {}}
      />,
    );
    expect(screen.getByText("Weekly Q&A")).toBeInTheDocument();
    expect(screen.getByText("Live questions, real answers.")).toBeInTheDocument();
    expect(screen.getByText(/Every Thursday at 11:00 AM/)).toBeInTheDocument();
    expect(screen.getByText("Launch Workshop")).toBeInTheDocument();
    expect(screen.getByText(/August 8, 2026 at 9:00 AM/)).toBeInTheDocument();
  });

  test("Approve button fires onAction(classroom, approve)", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <TextModuleCard
        asset={asset("classroom", {
          items: [{ title: "x", description: "y" }],
        })}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    expect(onAction).toHaveBeenCalledWith("classroom", "approve");
  });
});

describe("LeaderboardCard", () => {
  const LEVELS = [
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

  test("renders 9 levels with Lv N labels", () => {
    render(
      <LeaderboardCard
        asset={asset("leaderboard", { levels: LEVELS })}
        onAction={() => {}}
      />,
    );
    for (const name of LEVELS) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("Lv 1")).toBeInTheDocument();
    expect(screen.getByText("Lv 9")).toBeInTheDocument();
  });

  test("Edit button fires onAction(leaderboard, edit)", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <LeaderboardCard
        asset={asset("leaderboard", { levels: LEVELS })}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Edit$/ }));
    expect(onAction).toHaveBeenCalledWith("leaderboard", "edit");
  });
});

describe("CategoriesCard", () => {
  const CATEGORIES = [
    { name: "Plant your flag", description: "Say hi." },
    { name: "Wins", description: "Celebrate progress." },
    { name: "Ask the host", description: "Tips from the creator." },
  ];

  test("renders all 3 categories with name and description", () => {
    render(
      <CategoriesCard
        asset={asset("categories", { categories: CATEGORIES })}
        onAction={() => {}}
      />,
    );
    for (const cat of CATEGORIES) {
      expect(screen.getByText(cat.name)).toBeInTheDocument();
      expect(screen.getByText(cat.description)).toBeInTheDocument();
    }
  });
});

describe("DiscoverySeoCard", () => {
  const KEYWORDS = ["yoga", "breathwork", "mindfulness", "morning practice"];

  test("renders one chip per keyword", () => {
    render(
      <DiscoverySeoCard
        asset={asset("discovery_seo", { keywords: KEYWORDS })}
        onAction={() => {}}
      />,
    );
    for (const kw of KEYWORDS) {
      expect(screen.getByText(kw)).toBeInTheDocument();
    }
  });

  test("Regenerate button fires onAction(discovery_seo, regenerate)", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <DiscoverySeoCard
        asset={asset("discovery_seo", { keywords: KEYWORDS })}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Regenerate/i }));
    expect(onAction).toHaveBeenCalledWith("discovery_seo", "regenerate");
  });
});
