// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackagesList } from "@/components/dashboard/PackagesList";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("PackagesList", () => {
  test("renders one link per package pointing at /packages/[id]", () => {
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

  test("each row gets a Delete button labelled by community name", () => {
    render(
      <PackagesList
        packages={[
          { id: "pkg-1", communityName: "Founders Circle" },
          { id: "pkg-2", communityName: "Yoga Studio" },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Delete Founders Circle/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete Yoga Studio/i }),
    ).toBeInTheDocument();
  });

  test("clicking the trash icon opens a confirmation dialog with the community name", async () => {
    const user = userEvent.setup();
    render(
      <PackagesList
        packages={[{ id: "pkg-1", communityName: "Founders Circle" }]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Delete Founders Circle/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /Delete package\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Founders Circle.*cannot be undone/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Delete$/i })).toBeInTheDocument();
  });

  test("Cancel closes the dialog without calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PackagesList
        packages={[{ id: "pkg-1", communityName: "Founders Circle" }]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Delete Founders Circle/i }),
    );
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Founders Circle")).toBeInTheDocument();
  });

  test("confirming Delete calls DELETE /api/packages/[id] and removes the row", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PackagesList
        packages={[
          { id: "pkg-1", communityName: "Founders Circle" },
          { id: "pkg-2", communityName: "Yoga Studio" },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Delete Founders Circle/i }),
    );
    await user.click(screen.getByRole("button", { name: /^Delete$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/packages/pkg-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Founders Circle")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Yoga Studio")).toBeInTheDocument();
  });

  test("failed DELETE restores the row and surfaces the error", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal error" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { toast } = await import("sonner");

    render(
      <PackagesList
        packages={[{ id: "pkg-1", communityName: "Founders Circle" }]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Delete Founders Circle/i }),
    );
    await user.click(screen.getByRole("button", { name: /^Delete$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // Optimistic removal was reverted.
    expect(screen.getByText("Founders Circle")).toBeInTheDocument();
  });
});
