// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { PackagesList } from "@/components/dashboard/PackagesList";

describe("PackagesList", () => {
  test("renders one row per package with a link to /packages/[id]", () => {
    render(
      <PackagesList
        packages={[
          { id: "pkg-1", communityName: "Founders Circle" },
          { id: "pkg-2", communityName: "Yoga Studio" },
        ]}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/packages/pkg-1");
    expect(links[0]).toHaveTextContent("Founders Circle");
    expect(links[1]).toHaveAttribute("href", "/packages/pkg-2");
    expect(links[1]).toHaveTextContent("Yoga Studio");
  });

  test("falls back to 'Untitled community' when the name is empty", () => {
    render(
      <PackagesList packages={[{ id: "pkg-3", communityName: "" }]} />,
    );
    expect(screen.getByText("Untitled community")).toBeInTheDocument();
  });

  test("renders an empty list when given no packages", () => {
    const { container } = render(<PackagesList packages={[]} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});
