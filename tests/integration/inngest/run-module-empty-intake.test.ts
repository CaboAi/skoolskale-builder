/**
 * Integration test for the empty-intake skip path in `runModule()`.
 *
 * The five add-on text modules are now default-on (since image generation
 * was removed in PR #39 / the flip lands in feat/text-modules-default-on).
 * Two of them — classroom and calendar — need Step 5 intake to produce
 * anything meaningful. When the intake is missing, the prompt builder
 * throws a typed `EmptyIntakeError` and the runner writes an empty
 * generated_asset row + marks the job done. No failed status, no half-
 * generated state, no orchestrator-wide rollback.
 *
 * The other three add-on modules (leaderboard, categories, discovery_seo)
 * synthesize from the creator profile and don't need add-on intake; their
 * generators run cleanly even when classroom_titles / calendar_intake.events
 * are empty. Two smoke tests below confirm those builders don't throw.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { EmptyIntakeError } from "@/lib/inngest/cap-violation";

const { fetchPatternExamplesMock, generateMock, dbMock } = vi.hoisted(() => {
  const dbInsertReturning = vi.fn<() => Promise<{ id: string }[]>>(async () => [
    { id: "asset-1" },
  ]);
  const dbInsertValues = vi.fn();
  const dbUpdateSet = vi.fn();
  const dbUpdate = vi.fn(() => ({
    set: (s: unknown) => {
      dbUpdateSet(s);
      return { where: () => undefined };
    },
  }));
  const dbSelectLimit = vi.fn<() => Promise<Record<string, unknown>[]>>(
    async () => [{ id: "pkg-1", creatorId: "cr-1", createdBy: "user-1" }],
  );
  return {
    fetchPatternExamplesMock: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(
      async () => [],
    ),
    generateMock: vi.fn<
      (input: {
        systemPrompt: string;
        userMessage: string;
        jobId: string;
        maxTokens?: number;
      }) => Promise<{
        text: string;
        inputTokens: number;
        outputTokens: number;
        durationMs: number;
      }>
    >(),
    dbMock: {
      insert: () => ({
        values: (v: unknown) => {
          dbInsertValues(v);
          return { returning: dbInsertReturning };
        },
      }),
      update: dbUpdate,
      select: () => ({
        from: () => ({
          where: () => ({ limit: dbSelectLimit }),
        }),
      }),
      _spies: {
        dbInsertReturning,
        dbInsertValues,
        dbUpdate,
        dbUpdateSet,
        dbSelectLimit,
      },
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/generators/pattern-library", () => ({
  fetchPatternExamples: fetchPatternExamplesMock,
}));
vi.mock("@/lib/claude/generate", () => ({
  generate: generateMock,
}));

import { runModule } from "@/lib/inngest/functions/_shared";

const CREATOR_ROW_WITH_EMPTY_INTAKE = {
  id: "pkg-1",
  creatorId: "cr-1",
  createdBy: "user-1",
  name: "Jane",
  communityName: "Sanctuary",
  niche: "spiritual",
  audience: "soul-led women",
  transformation: "reclaim power",
  tone: "warm",
  offerBreakdown: {
    courses: [],
    perks: [],
    events: [],
    guest_sessions: false,
  },
  pricing: { tiers: [] },
  trialTerms: { has_trial: false },
  refundPolicy: "",
  supportContact: "Ramsha A.",
  brandPrefs: "",
  creatorPhotoUrl: null,
  classroomTitles: null,
  calendarIntake: null,
  leaderboardLevels: null,
  categories: null,
  discoveryKeywords: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchPatternExamplesMock.mockResolvedValue([]);
  dbMock._spies.dbInsertReturning.mockResolvedValue([{ id: "asset-1" }]);
  dbMock._spies.dbSelectLimit.mockResolvedValue([CREATOR_ROW_WITH_EMPTY_INTAKE]);
});

/**
 * Prompt fixture that delegates to a real prompt module's `buildUserMessage`
 * so we exercise the actual empty-intake guard (rather than mocking the
 * throw). Each test imports the prompt module dynamically to avoid hoisting
 * issues with vi.mock.
 */

describe("runModule empty-intake skip", () => {
  test("classroom: missing classroom_titles → writes empty {items: []} asset, marks job done, no Claude call", async () => {
    const classroomPrompt = await import("@/prompts/classroom");

    await runModule({
      packageId: "pkg-1",
      module: "classroom",
      jobId: "job-1",
      userId: "user-1",
      prompt: classroomPrompt,
    });

    // generate() must NOT have been called — we short-circuit before Claude.
    expect(generateMock).not.toHaveBeenCalled();

    // Asset row written with empty items.
    expect(dbMock._spies.dbInsertValues).toHaveBeenCalledTimes(1);
    const persisted = dbMock._spies.dbInsertValues.mock.calls[0][0] as {
      module: string;
      content: { items: unknown[] };
    };
    expect(persisted.module).toBe("classroom");
    expect(persisted.content).toEqual({ items: [] });

    // Job marked done (not failed).
    const updateSet = dbMock._spies.dbUpdateSet.mock.calls[0][0] as {
      status: string;
    };
    expect(updateSet.status).toBe("done");
  });

  test("calendar: missing calendar_intake → writes empty {events: []} asset, marks job done, no Claude call", async () => {
    const calendarPrompt = await import("@/prompts/calendar");

    await runModule({
      packageId: "pkg-1",
      module: "calendar",
      jobId: "job-2",
      userId: "user-1",
      prompt: calendarPrompt,
    });

    expect(generateMock).not.toHaveBeenCalled();

    const persisted = dbMock._spies.dbInsertValues.mock.calls[0][0] as {
      module: string;
      content: { events: unknown[] };
    };
    expect(persisted.module).toBe("calendar");
    expect(persisted.content).toEqual({ events: [] });

    const updateSet = dbMock._spies.dbUpdateSet.mock.calls[0][0] as {
      status: string;
    };
    expect(updateSet.status).toBe("done");
  });

  test("EmptyIntakeError carries the per-module emptyContent payload", () => {
    // Direct sanity check on the typed error: each generator owns the
    // shape of its 'skipped' asset; the runner consumes it as opaque
    // JSON.
    const err = new EmptyIntakeError({
      module: "calendar",
      moduleLabel: "Calendar",
      emptyContent: { events: [] },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("EmptyIntakeError");
    expect(err.module).toBe("calendar");
    expect(err.emptyContent).toEqual({ events: [] });
    expect(err.message).toContain("no intake supplied");
  });
});

describe("runModule no-intake-required modules still generate cleanly", () => {
  // These three modules synthesize from the creator profile alone, so
  // their buildUserMessage doesn't throw when add-on intake is missing.
  // We only confirm the prompt builder itself is empty-intake-safe;
  // exercising the full Claude path adds nothing here.
  test.each([
    { name: "leaderboard", module: "@/prompts/leaderboard" },
    { name: "categories", module: "@/prompts/categories" },
    { name: "discovery_seo", module: "@/prompts/discovery_seo" },
  ])("$name builds a prompt with empty add-on intake", async ({ module }) => {
    const prompt = await import(/* @vite-ignore */ module);
    const input = {
      creator: {
        name: "Jane",
        community_name: "Sanctuary",
        niche: "spiritual" as const,
        audience: "soul-led women",
        transformation: "reclaim power",
        tone: "warm" as const,
        offer_breakdown: { perks: [], guest_sessions: false },
        pricing: { additional_tiers: [] },
        trial_terms: { has_trial: false, duration_days: 7 as const },
        refund_policy: "",
        support_contact: "Ramsha A.",
        brand_prefs: "",
        creator_photo_url: undefined,
        classroom_titles: [],
        calendar_intake: undefined,
      },
      patternLibrary: [],
    };
    // None of these should throw.
    expect(() => prompt.buildUserMessage(input)).not.toThrow();
  });
});
