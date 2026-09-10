// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { CreatorEditForm } from "@/app/creators/[id]/edit/edit-form";
import { creatorToIntake } from "@/lib/creators/to-intake";
import { makeCreator } from "../../prompts/handover/fixtures";

const INITIAL = creatorToIntake(
  makeCreator({
    classroomIntake: ["Foundations"],
    pricing: { monthly: 27, annual: 227, additional_tiers: [] },
  }),
);

function renderForm() {
  return render(
    <CreatorEditForm
      creatorId="cr-1"
      returnTo="/packages/pkg-1"
      initial={INITIAL}
    />,
  );
}

/** The community-name input, which every section shares a form with. */
function communityInput() {
  return screen.getByLabelText(/community name/i);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CreatorEditForm", () => {
  test("prefills the community name from the creator row", () => {
    renderForm();
    expect(communityInput()).toHaveValue("Soul Collective");
  });

  test("Save is disabled until something is edited", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  test("no stale-module warning before an edit is made", () => {
    renderForm();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("renaming the community warns that generated copy goes stale", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(communityInput());
    await user.type(communityInput(), "Align Skool");

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(/will not rewrite copy/i);
    // Community name feeds every text generator, so the tour copy that names
    // the community is listed among the modules to regenerate.
    expect(warning).toHaveTextContent(/start here/i);
  });

  test("saving PATCHes the creator with the edited value", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(communityInput());
    await user.type(communityInput(), "Align Skool");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("/api/creators/cr-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toMatchObject({
      community_name: "Align Skool",
      name: "Jane Doe",
    });
  });

  test("a successful save returns to where the VA came from", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(communityInput());
    await user.type(communityInput(), "Align Skool");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/packages/pkg-1"));
    expect(refreshMock).toHaveBeenCalled();
  });

  test("a failed save surfaces the API's message and stays on the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Creator not found." }), {
            status: 404,
          }),
      ),
    );
    const user = userEvent.setup();
    renderForm();

    await user.clear(communityInput());
    await user.type(communityInput(), "Align Skool");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Creator not found.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
