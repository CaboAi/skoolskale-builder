/**
 * Integration test for the cap-violation retry branch in `runModule()`.
 *
 * Skool truncates Welcome DM at 300 chars and About Us around 1,050 —
 * the parsers in @/prompts/welcome-dm and @/prompts/about-us throw a
 * typed CapViolationError when the rendered output is over cap. The
 * runner catches it once per run, appends a "rewrite tighter" follow-up
 * to the original user message, and re-calls Claude. The retry uses the
 * ORIGINAL system + user message (not the regenerated mid-attempt one)
 * with the previous output + numeric feedback appended.
 *
 * Mocking strategy mirrors `run-module-edited-prompt.test.ts`: stub the
 * Claude call + DB so we drive the parser path with controlled inputs.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { CapViolationError } from "@/lib/inngest/cap-violation";

const { fetchPatternExamplesMock, generateMock, dbMock } = vi.hoisted(() => {
  const dbInsertReturning = vi.fn<() => Promise<{ id: string }[]>>(async () => [
    { id: "asset-1" },
  ]);
  const dbUpdate = vi.fn(() => ({
    set: () => ({
      where: () => undefined,
    }),
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

import { runModule } from "@/lib/inngest/functions/_shared";

beforeEach(() => {
  vi.clearAllMocks();
  fetchPatternExamplesMock.mockResolvedValue([]);
  dbMock._spies.dbInsertReturning.mockResolvedValue([{ id: "asset-1" }]);
  dbMock._spies.dbSelectLimit.mockResolvedValue([
    {
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
    },
  ]);
});

/**
 * Synthetic prompt module with a parseOutput that flips between
 * over-cap and under-cap on successive calls — proves the runner's
 * retry path without depending on Claude's actual behavior.
 */
function makeCapFlippingPrompt(opts: { firstAttemptOverCap: boolean }) {
  let calls = 0;
  return {
    systemPrompt: "sys",
    buildUserMessage: () => "ORIGINAL USER MESSAGE",
    parseOutput: (raw: string) => {
      calls += 1;
      if (calls === 1 && opts.firstAttemptOverCap) {
        throw new CapViolationError({
          module: "welcome_dm",
          moduleLabel: "Welcome DM",
          actualChars: 320,
          maxChars: 275,
          rawOutput: raw,
        });
      }
      return { content: raw };
    },
    _calls: () => calls,
  };
}

describe("runModule cap-violation retry", () => {
  test("first attempt over-cap → retry fires with the rewrite-tighter follow-up", async () => {
    generateMock.mockResolvedValueOnce({
      text: "OVER_CAP_OUTPUT",
      inputTokens: 10,
      outputTokens: 50,
      durationMs: 100,
    });
    generateMock.mockResolvedValueOnce({
      text: "UNDER_CAP_OUTPUT",
      inputTokens: 10,
      outputTokens: 20,
      durationMs: 80,
    });

    const prompt = makeCapFlippingPrompt({ firstAttemptOverCap: true });
    await runModule({
      packageId: "pkg-1",
      module: "welcome_dm",
      jobId: "job-1",
      userId: "user-1",
      prompt,
    });

    expect(generateMock).toHaveBeenCalledTimes(2);
    const firstUserMessage = (generateMock.mock.calls[0][0] as { userMessage: string })
      .userMessage;
    const secondUserMessage = (generateMock.mock.calls[1][0] as { userMessage: string })
      .userMessage;
    expect(firstUserMessage).toBe("ORIGINAL USER MESSAGE");
    expect(secondUserMessage).toContain("ORIGINAL USER MESSAGE");
    expect(secondUserMessage).toContain("That was 320 characters");
    expect(secondUserMessage).toContain("Cap is 275");
    expect(secondUserMessage).toContain("OVER_CAP_OUTPUT");

    // The successful retry persists exactly one asset row.
    expect(dbMock._spies.dbInsertReturning).toHaveBeenCalledTimes(1);
  });

  test("first attempt under-cap → no retry, single Claude call", async () => {
    generateMock.mockResolvedValueOnce({
      text: "UNDER_CAP_OUTPUT",
      inputTokens: 10,
      outputTokens: 20,
      durationMs: 80,
    });

    const prompt = makeCapFlippingPrompt({ firstAttemptOverCap: false });
    await runModule({
      packageId: "pkg-1",
      module: "welcome_dm",
      jobId: "job-1",
      userId: "user-1",
      prompt,
    });

    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(prompt._calls()).toBe(1);
  });

  test("both attempts over-cap → CapViolationError propagates after one retry", async () => {
    generateMock.mockResolvedValue({
      text: "OVER_CAP_OUTPUT",
      inputTokens: 10,
      outputTokens: 50,
      durationMs: 100,
    });

    const alwaysOverCap = {
      systemPrompt: "sys",
      buildUserMessage: () => "ORIGINAL",
      parseOutput: (raw: string) => {
        throw new CapViolationError({
          module: "about_us",
          moduleLabel: "About Us",
          actualChars: 1247,
          maxChars: 1050,
          rawOutput: raw,
        });
      },
    };

    await expect(
      runModule({
        packageId: "pkg-1",
        module: "about_us",
        jobId: "job-1",
        userId: "user-1",
        prompt: alwaysOverCap,
      }),
    ).rejects.toBeInstanceOf(CapViolationError);

    // Two attempts then surrender.
    expect(generateMock).toHaveBeenCalledTimes(2);
  });

  test("non-cap parse errors do NOT trigger the retry path", async () => {
    generateMock.mockResolvedValueOnce({
      text: "BROKEN_OUTPUT",
      inputTokens: 10,
      outputTokens: 50,
      durationMs: 100,
    });

    const structurallyBroken = {
      systemPrompt: "sys",
      buildUserMessage: () => "ORIGINAL",
      parseOutput: () => {
        throw new Error("welcome_dm: missing #NAME# merge tag");
      },
    };

    await expect(
      runModule({
        packageId: "pkg-1",
        module: "welcome_dm",
        jobId: "job-1",
        userId: "user-1",
        prompt: structurallyBroken,
      }),
    ).rejects.toThrow(/missing #NAME#/);

    expect(generateMock).toHaveBeenCalledTimes(1);
  });
});
