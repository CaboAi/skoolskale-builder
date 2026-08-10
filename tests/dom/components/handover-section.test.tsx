// @vitest-environment jsdom
/**
 * DOM tests for the package dashboard's HandoverSection
 * (src/components/dashboard/HandoverSection.tsx).
 *
 * fetch is stubbed globally (GET → HandoverResponse fixture, POST → 202) and
 * the component rendered inside a retry-free QueryClientProvider, following
 * the PackageDashboard-regenerate-timeout.test.tsx conventions.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HandoverSection } from "@/components/dashboard/HandoverSection";
import {
  HANDOVER_DOC_LABELS,
  type HandoverDocKey,
} from "@/prompts/handover/deliverables";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const PKG_ID = "pkg-1";
const DOC_KEYS = Object.keys(HANDOVER_DOC_LABELS) as HandoverDocKey[];

type RunFixture = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  includeGuestEmails: boolean;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

function runFixture(
  status: RunFixture["status"],
  overrides: Partial<RunFixture> = {},
): RunFixture {
  return {
    id: "run-1",
    status,
    includeGuestEmails: false,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function docFixture(docKey: HandoverDocKey, pdfPath: string | null) {
  return {
    id: `doc-${docKey}`,
    runId: "run-1",
    docKey,
    version: 1,
    pdfPath,
    pdfAvailable: pdfPath !== null,
    wordCount: 1200,
    placeholderCount: docKey === "readme" ? 0 : 3,
    createdAt: new Date().toISOString(),
  };
}

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

function stubFetch(getResponse: {
  run: RunFixture | null;
  documents: ReturnType<typeof docFixture>[];
}) {
  const fetchMock = vi.fn(async (...[, init]: FetchArgs) => {
    if (init?.method === "POST") {
      return {
        ok: true,
        status: 202,
        json: async () => ({ status: "queued", runId: "run-9" }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => getResponse,
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function postCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(
    ([, init]: FetchArgs) => init?.method === "POST",
  );
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HandoverSection packageId={PKG_ID} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HandoverSection", () => {
  test("no run: Generate Handover button enabled, checkbox present and unchecked", async () => {
    stubFetch({ run: null, documents: [] });
    renderSection();

    const button = await screen.findByRole("button", {
      name: "Generate Handover",
    });
    expect(button).toBeEnabled();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  test("active run: button disabled and labelled Generating…", async () => {
    stubFetch({ run: runFixture("running"), documents: [] });
    renderSection();

    const button = await screen.findByRole("button", { name: /Generating/ });
    expect(button).toBeDisabled();
    // The guest-emails checkbox locks during a run too. Base UI conveys
    // disabled state via data-disabled, not the native attribute.
    await waitFor(() =>
      expect(screen.getByRole("checkbox")).toHaveAttribute("data-disabled"),
    );
  });

  test("done run with 6 documents: labelled rows, PDF link only when pdfAvailable, .md always", async () => {
    // Every doc has a PDF except dm_sequences (its render step not done).
    stubFetch({
      run: runFixture("done", { completedAt: new Date().toISOString() }),
      documents: DOC_KEYS.map((key) =>
        docFixture(key, key === "dm_sequences" ? null : `${PKG_ID}/run-1/${key}.pdf`),
      ),
    });
    renderSection();

    for (const key of DOC_KEYS) {
      expect(await screen.findByText(HANDOVER_DOC_LABELS[key])).toBeInTheDocument();
    }

    const mdLinks = screen.getAllByRole("link", { name: ".md" });
    expect(mdLinks).toHaveLength(6);
    expect(mdLinks[0]).toHaveAttribute(
      "href",
      `/api/packages/${PKG_ID}/handover/documents/readme/md`,
    );

    const pdfLinks = screen.getAllByRole("link", { name: /PDF/ });
    expect(pdfLinks).toHaveLength(5);
    expect(pdfLinks[0]).toHaveAttribute(
      "href",
      `/api/packages/${PKG_ID}/handover/documents/readme/pdf`,
    );

    // Docs exist → the CTA flips to regenerate wording and stays enabled.
    expect(
      screen.getByRole("button", { name: "Regenerate Handover" }),
    ).toBeEnabled();
  });

  test("timed-out run: give-up notice shown and the button re-enabled for failover", async () => {
    // Active run created 21 minutes ago — past HANDOVER_POLL_GIVE_UP_MS.
    // The POST route fails over stale runs, so the button must come back.
    stubFetch({
      run: runFixture("running", {
        createdAt: new Date(Date.now() - 21 * 60_000).toISOString(),
      }),
      documents: [],
    });
    renderSection();

    expect(
      await screen.findByText(/presumed dead/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Regenerate Handover" }),
    ).toBeEnabled();
  });

  test("failed run: error text visible and the button re-enabled", async () => {
    stubFetch({
      run: runFixture("failed", { error: "opus exploded" }),
      documents: [],
    });
    renderSection();

    expect(
      await screen.findByText(/Last run failed: opus exploded/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate Handover" }),
    ).toBeEnabled();
  });

  test("generate POSTs includeGuestEmails:false by default", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({ run: null, documents: [] });
    renderSection();

    await user.click(
      await screen.findByRole("button", { name: "Generate Handover" }),
    );

    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1));
    const [url, init] = postCalls(fetchMock)[0];
    expect(url).toBe(`/api/packages/${PKG_ID}/handover`);
    expect(init?.body).toBe('{"includeGuestEmails":false}');
  });

  test("generate POSTs includeGuestEmails:true after ticking the checkbox", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({ run: null, documents: [] });
    renderSection();

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(
      screen.getByRole("button", { name: "Generate Handover" }),
    );

    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1));
    const [, init] = postCalls(fetchMock)[0];
    expect(init?.body).toBe('{"includeGuestEmails":true}');
  });
});
