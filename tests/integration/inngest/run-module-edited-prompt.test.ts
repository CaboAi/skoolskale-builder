/**
 * Integration test for the editedPrompt skip-builder branch in
 * `runModule()` (src/lib/inngest/functions/_shared.ts).
 *
 * runModule is the per-module pipeline used by the text-module factory
 * (_factory.ts), so this single test covers the wiring for all 9 text
 * modules: welcome_dm, transformation, about_us, start_here, classroom,
 * calendar, leaderboard, categories, discovery_seo.
 *
 * What we prove:
 *   - editedPrompt = undefined → builder is called, fetchPatternExamples
 *     is called, generate() receives the builder's output as userMessage.
 *   - editedPrompt = "..." → builder is NOT called, fetchPatternExamples
 *     is NOT called, loadCreatorForPackage is NOT called, generate()
 *     receives the editedPrompt verbatim as userMessage.
 *
 * The 4 image Inngest functions implement the same `if (data.editedPrompt)`
 * branch in their per-function `prepare` step. They're not covered by this
 * test (each has its own step.run + retry harness that's painful to mock);
 * the branch is a 3-line if-return in each, validated by typecheck + code
 * review. A follow-up PR can add the per-image-function harness if the
 * branch ever gets non-trivial.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

const { fetchPatternExamplesMock, generateMock, dbMock } = vi.hoisted(() => {
  const dbInsertReturning = vi.fn(async () => [{ id: "asset-1" }]);
  const dbUpdate = vi.fn(() => ({
    set: () => ({
      where: () => undefined,
    }),
  }));
  const dbSelectLimit = vi.fn(async () => [
    {
      id: "pkg-1",
      creatorId: "cr-1",
      createdBy: "user-1",
    },
  ]);
  return {
    fetchPatternExamplesMock: vi.fn(async () => []),
    generateMock: vi.fn(async () => ({
      text: "<welcome_dm>generated</welcome_dm>",
      inputTokens: 10,
      outputTokens: 20,
      durationMs: 100,
    })),
    dbMock: {
      insert: () => ({
        values: () => ({
          returning: dbInsertReturning,
        }),
      }),
      update: dbUpdate,
      select: () => ({
        from: () => ({
          where: () => ({
            limit: dbSelectLimit,
          }),
        }),
      }),
      _spies: { dbInsertReturning, dbUpdate, dbSelectLimit },
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

const PROMPT_FIXTURE = {
  systemPrompt: "system prompt body",
  buildUserMessage: vi.fn(() => "BUILT BY THE BUILDER"),
  parseOutput: (raw: string) => ({ raw }),
};

beforeEach(() => {
  vi.clearAllMocks();
  PROMPT_FIXTURE.buildUserMessage.mockClear();
  PROMPT_FIXTURE.buildUserMessage.mockReturnValue("BUILT BY THE BUILDER");
  generateMock.mockResolvedValue({
    text: "<welcome_dm>generated</welcome_dm>",
    inputTokens: 10,
    outputTokens: 20,
    durationMs: 100,
  });
  fetchPatternExamplesMock.mockResolvedValue([]);
  dbMock._spies.dbInsertReturning.mockResolvedValue([{ id: "asset-1" }]);
  dbMock._spies.dbSelectLimit.mockResolvedValue([
    {
      id: "pkg-1",
      creatorId: "cr-1",
      createdBy: "user-1",
      // Stand-in creator row shape; toCreatorContext widens jsonb fields,
      // and runModule then passes the result into the (mocked) builder
      // which doesn't actually read it.
      name: "Jane",
      communityName: "Sanctuary",
      niche: "spiritual",
      audience: "x",
      transformation: "x",
      tone: "warm",
      offerBreakdown: { courses: [], perks: [], events: [], guest_sessions: false },
      pricing: { tiers: [] },
      trialTerms: { has_trial: false },
      refundPolicy: "",
      supportContact: "x",
      brandPrefs: "",
      creatorPhotoUrl: null,
    },
  ]);
});

describe("runModule editedPrompt branch", () => {
  test("WITHOUT editedPrompt: calls builder + pattern lookup + uses builder output", async () => {
    const { runModule } = await import("@/lib/inngest/functions/_shared");
    await runModule({
      packageId: "pkg-1",
      module: "welcome_dm",
      jobId: "job-1",
      userId: "user-1",
      prompt: PROMPT_FIXTURE,
    });
    expect(PROMPT_FIXTURE.buildUserMessage).toHaveBeenCalledTimes(1);
    expect(fetchPatternExamplesMock).toHaveBeenCalledTimes(1);
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: "BUILT BY THE BUILDER" }),
    );
  });

  test("WITH editedPrompt: skips builder + pattern lookup; passes edited string verbatim", async () => {
    const { runModule } = await import("@/lib/inngest/functions/_shared");
    await runModule({
      packageId: "pkg-1",
      module: "welcome_dm",
      jobId: "job-1",
      userId: "user-1",
      prompt: PROMPT_FIXTURE,
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    expect(PROMPT_FIXTURE.buildUserMessage).not.toHaveBeenCalled();
    expect(fetchPatternExamplesMock).not.toHaveBeenCalled();
    // creator lookup is skipped too — runModule short-circuits before it.
    expect(dbMock._spies.dbSelectLimit).not.toHaveBeenCalled();
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: "EDITED PROMPT FROM THE VA" }),
    );
  });

  test("WITH editedPrompt: regenerateNote is ignored (suffix not added)", async () => {
    const { runModule } = await import("@/lib/inngest/functions/_shared");
    await runModule({
      packageId: "pkg-1",
      module: "welcome_dm",
      jobId: "job-1",
      userId: "user-1",
      prompt: PROMPT_FIXTURE,
      regenerateNote: "shorter please",
      editedPrompt: "EDITED PROMPT FROM THE VA",
    });
    const call = generateMock.mock.calls[0][0] as { userMessage: string };
    expect(call.userMessage).toBe("EDITED PROMPT FROM THE VA");
    expect(call.userMessage).not.toContain("USER FEEDBACK");
    expect(call.userMessage).not.toContain("shorter please");
  });
});
