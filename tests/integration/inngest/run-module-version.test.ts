/**
 * Integration test for asset versioning in `runModule()`
 * (src/lib/inngest/functions/_shared.ts).
 *
 * Regeneration appends a new generated_assets row rather than updating the
 * existing one. Before this was fixed every row was written with a hardcoded
 * version 1, so "which row is latest" fell back to created_at alone and the
 * dashboard's per-module lookup could land on a stale row — leaving the card
 * stuck on its regenerating skeleton forever.
 *
 * What we prove:
 *   - first generation for a module (no prior rows) → version 1
 *   - regeneration over an existing max version → max + 1
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

const { generateMock, dbMock } = vi.hoisted(() => {
  const dbInsertValues =
    vi.fn<(row: Record<string, unknown>) => { returning: () => Promise<{ id: string }[]> }>(
      () => ({ returning: async () => [{ id: "asset-1" }] }),
    );
  // Rows returned by the version lookup (`select().from().where().orderBy().limit()`).
  const dbVersionLimit =
    vi.fn<() => Promise<{ version: number }[]>>(async () => []);
  return {
    generateMock: vi.fn<
      () => Promise<{
        text: string;
        inputTokens: number;
        outputTokens: number;
        durationMs: number;
      }>
    >(async () => ({
      text: "<welcome_dm>generated</welcome_dm>",
      inputTokens: 10,
      outputTokens: 20,
      durationMs: 100,
    })),
    dbMock: {
      insert: () => ({ values: dbInsertValues }),
      update: () => ({ set: () => ({ where: () => undefined }) }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              { id: "pkg-1", creatorId: "cr-1", createdBy: "user-1" },
            ],
            orderBy: () => ({ limit: dbVersionLimit }),
          }),
        }),
      }),
      _spies: { dbInsertValues, dbVersionLimit },
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/generators/pattern-library", () => ({
  fetchPatternExamples: async () => [],
}));
vi.mock("@/lib/claude/generate", () => ({ generate: generateMock }));

import { runModule } from "@/lib/inngest/functions/_shared";

const PROMPT_FIXTURE = {
  systemPrompt: "system prompt body",
  buildUserMessage: () => "BUILT BY THE BUILDER",
  parseOutput: (raw: string) => ({ raw }),
};

const RUN_ARGS = {
  packageId: "pkg-1",
  module: "welcome_dm" as const,
  jobId: "job-1",
  userId: "user-1",
  prompt: PROMPT_FIXTURE,
};

function insertedVersion() {
  return dbMock._spies.dbInsertValues.mock.calls.at(-1)?.[0].version;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock._spies.dbInsertValues.mockReturnValue({
    returning: async () => [{ id: "asset-1" }],
  });
});

describe("runModule asset versioning", () => {
  test("no prior rows for the module → writes version 1", async () => {
    dbMock._spies.dbVersionLimit.mockResolvedValue([]);
    await runModule({ ...RUN_ARGS, editedPrompt: "EDITED" });
    expect(insertedVersion()).toBe(1);
  });

  test("existing max version 3 → regeneration writes version 4", async () => {
    dbMock._spies.dbVersionLimit.mockResolvedValue([{ version: 3 }]);
    await runModule({ ...RUN_ARGS, editedPrompt: "EDITED" });
    expect(insertedVersion()).toBe(4);
  });

  test("builder path (no editedPrompt) versions the same way", async () => {
    dbMock._spies.dbVersionLimit.mockResolvedValue([{ version: 7 }]);
    await runModule(RUN_ARGS);
    expect(insertedVersion()).toBe(8);
  });
});
