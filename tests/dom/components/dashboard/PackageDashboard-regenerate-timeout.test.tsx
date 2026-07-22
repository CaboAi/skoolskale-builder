// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackageDashboard } from "@/components/dashboard/PackageDashboard";
import { MODULE_LABELS } from "@/lib/modules/registry";
import type { Creator, GeneratedAsset, LaunchPackage } from "@/lib/db/schema";

/**
 * A regeneration that fails inside Inngest never writes a new asset row, so
 * the dashboard's "did the asset id change?" completion check never fires.
 * Before the give-up timer, the card sat on its skeleton and polled every 3s
 * indefinitely with no error surfaced — indistinguishable from "still working".
 *
 * This drives the real card → dialog → mutation path and asserts the card
 * recovers (and says why) once the timeout elapses.
 *
 * Not covered here: the happy path where a new asset DOES arrive and clears
 * the state before the deadline. That completion runs off a react-query
 * refetch, and in this jsdom harness cache updates never propagate to a
 * re-render — setQueryData included — so the assertion could not be made
 * honestly. That path is unchanged by this commit.
 */

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mirror of REGENERATE_TIMEOUT_MS in PackageDashboard.tsx. Kept above the
// 300s Inngest per-invocation ceiling so the timer only fires on a dead run.
const TIMEOUT_MS = 360_000;

/**
 * Date must be faked — the give-up timer compares Date.now() against an
 * absolute deadline, so a fake setTimeout with a real clock would fire and
 * then decide nothing had expired. queueMicrotask must NOT be faked: the
 * regeneration-complete path schedules its state update through it, and a
 * stubbed version never drains under waitFor's real-timer polling.
 */
function useTimers() {
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
}
const TARGET = "transformation";
const TARGET_LABEL = MODULE_LABELS[TARGET];

function asset(module: string): GeneratedAsset {
  return {
    id: `asset-${module}`,
    packageId: "pkg-1",
    module,
    version: 1,
    content: { candidates: ["Stop guessing. Ship the thing you keep postponing."] },
    approved: false,
    approvedBy: null,
    approvedAt: null,
    editHistory: [],
    vaNotes: null,
    qualityScore: null,
    createdBy: "user-1",
    createdAt: new Date("2026-07-19T18:00:00Z"),
  } as GeneratedAsset;
}

const PACKAGE = {
  id: "pkg-1",
  creatorId: "cr-1",
  status: "review",
  createdBy: "user-1",
  createdAt: new Date("2026-07-19T17:00:00Z"),
} as LaunchPackage;

const CREATOR = {
  id: "cr-1",
  name: "Ada",
  communityName: "Founders Circle",
  niche: "business",
  tone: "direct",
} as Creator;

// Only the module under test has an asset. The rest render as skeletons,
// which is fine — every assertion is scoped to the target card.
const ASSETS = [asset(TARGET)];

/** The <Card> wrapping a given module, located via its title. */
function cardFor(label: string) {
  const heading = screen.getByText(label);
  const card = heading.closest("[data-slot='card']");
  if (!card) throw new Error(`no card found for ${label}`);
  return card as HTMLElement;
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PackageDashboard package={PACKAGE} creator={CREATOR} assets={ASSETS} />
    </QueryClientProvider>,
  );
}

/**
 * Timer advances have to run inside act(): the resulting react-query and
 * setState updates originate outside React's event system, and without the
 * wrapper they land in the cache but are never committed to the DOM.
 */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Opens the regenerate dialog for the target module and confirms it. */
async function startRegeneration(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(cardFor(TARGET_LABEL)).getByRole("button", { name: "Regenerate" }),
  );
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: /^Regenerate$/ }));
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  // The regenerate POST succeeds (Inngest accepted the job); the package
  // refetch keeps returning the SAME asset ids — i.e. the run never produced
  // a new row, which is exactly the failure mode under test.
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/regenerate")) {
      return new Response(JSON.stringify({ status: "queued" }), { status: 202 });
    }
    return new Response(
      JSON.stringify({ package: PACKAGE, creator: CREATOR, assets: ASSETS }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

describe("PackageDashboard regenerate give-up timer", () => {
  test("a regeneration that never returns a new asset recovers after the timeout", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    useTimers();

    renderDashboard();
    await startRegeneration(user);

    // Card is on its skeleton: no action buttons while regenerating.
    await waitFor(() => {
      expect(
        within(cardFor(TARGET_LABEL)).queryByRole("button", {
          name: "Regenerate",
        }),
      ).not.toBeInTheDocument();
    });

    // Just shy of the deadline it is still waiting — no error, still a skeleton.
    await advance(TIMEOUT_MS - 1_000);
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      within(cardFor(TARGET_LABEL)).queryByRole("button", {
        name: "Regenerate",
      }),
    ).not.toBeInTheDocument();

    await advance(2_000);

    await waitFor(() => {
      expect(
        within(cardFor(TARGET_LABEL)).getByRole("button", {
          name: "Regenerate",
        }),
      ).toBeInTheDocument();
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain(TARGET_LABEL);
    // Never falsely reported success.
    expect(toast.success).not.toHaveBeenCalled();
  });

});
