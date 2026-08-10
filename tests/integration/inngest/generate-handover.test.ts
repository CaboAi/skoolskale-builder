/**
 * Integration tests for the handover orchestrator
 * (src/lib/inngest/functions/generate-handover.ts).
 *
 * The Inngest function object exposes its handler as the public `fn` field
 * (inngest v4 InngestFunction), so we invoke it directly with a fake
 * `step = { run: (id, fn) => fn() }` — steps execute inline, which preserves
 * the orchestrator's own ordering: deliverable 01 is awaited alone (the
 * prompt-cache prime) before the remaining four fire inside Promise.all.
 *
 * What we prove:
 *   (a) cache-prime ordering — doc 01's Claude call COMPLETES before any of
 *       02–05 begin, and 02–05 all begin before any of them ends (parallel)
 *   (b) 5 generated docs + 1 readme are inserted
 *   (c) the readme checklist carries the placeholder labels scanned from the
 *       generated docs ([[CREATOR STORY: x]] → [[CREATOR STORY]])
 *   (d) finalize marks the run done with aggregated usage and increments
 *       launch_packages.totalCostUsd
 *   (e) load-source throws NonRetriableError when required modules lack
 *       approval
 *
 * Mocking follows run-module-version.test.ts / run-module-cap-retry.test.ts:
 * all mutable state lives in vi.hoisted (never closure-captured inside a
 * vi.mock factory) so nothing leaks across parallel workers.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { NonRetriableError } from "inngest";

const { state, holder, generateHandoverDocMock, renderPdfsMock, logAuditMock, dbMock } =
  vi.hoisted(() => {
    type Row = Record<string, unknown>;
    const state = {
      calls: [] as string[],
      inserted: [] as Row[],
      docs: [] as Row[],
      updates: [] as { table: unknown; payload: Row }[],
      packages: [] as Row[],
      creators: [] as Row[],
      assets: [] as Row[],
    };
    // Table identities are filled in at module load (after the schema import)
    // so the query mock can dispatch on which table a select targets.
    const holder: {
      launchPackages?: unknown;
      creators?: unknown;
      generatedAssets?: unknown;
      handoverDocuments?: unknown;
    } = {};
    const rowsFor = (table: unknown): Row[] => {
      if (table === holder.launchPackages) return state.packages;
      if (table === holder.creators) return state.creators;
      if (table === holder.generatedAssets) return state.assets;
      if (table === holder.handoverDocuments) return state.docs;
      return [];
    };
    // where() result must be awaitable directly (loadRunDocuments), support
    // .limit() (pkg/creator lookups), and .orderBy() both awaited (asset
    // load) and .limit()-ed (per-docKey version lookup → [] keeps versions
    // at 1, which no assertion depends on).
    const whereChain = (table: unknown) =>
      Object.assign(
        Promise.resolve().then(() => rowsFor(table)),
        {
          limit: async () => rowsFor(table),
          orderBy: () =>
            Object.assign(
              Promise.resolve().then(() => rowsFor(table)),
              { limit: async () => [] as Row[] },
            ),
        },
      );
    const dbMock = {
      select: () => ({
        from: (table: unknown) => ({ where: () => whereChain(table) }),
      }),
      insert: () => ({
        values: (row: Row) => {
          state.inserted.push(row);
          const withId: Row = {
            id: `doc-${state.inserted.length}`,
            pdfPath: null,
            claudeUsage: null,
            ...row,
          };
          state.docs.push(withId);
          return { returning: async () => [{ id: withId.id as string }] };
        },
      }),
      update: (table: unknown) => ({
        set: (payload: Row) => ({
          where: async () => {
            state.updates.push({ table, payload });
          },
        }),
      }),
    };
    return {
      state,
      holder,
      generateHandoverDocMock: vi.fn<
        (params: {
          systemBlocks: unknown[];
          userMessage: string;
        }) => Promise<{ text: string; usage: Record<string, unknown> }>
      >(),
      renderPdfsMock:
        vi.fn<(params: unknown) => Promise<{ rendered: number }>>(),
      logAuditMock: vi.fn<(...args: unknown[]) => Promise<void>>(
        async () => undefined,
      ),
      dbMock,
    };
  });

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("@/lib/claude/generate-handover", () => ({
  generateHandoverDoc: generateHandoverDocMock,
}));
vi.mock("@/lib/handover/pdf-step", () => ({
  renderHandoverDocPdfs: renderPdfsMock,
}));
// Stateless — keeps the orchestrator off the filesystem.
vi.mock("@/prompts/handover/load-assets", () => ({
  loadHandoverAsset: (name: string) => `ASSET(${name})`,
  assertHandoverAssets: () => undefined,
}));
// Transitive deps of _shared.ts (imported for the generatedAssets re-export);
// minimal stateless factories — this test never exercises them.
vi.mock("@/lib/generators/pattern-library", () => ({
  fetchPatternExamples: async () => [],
}));
vi.mock("@/lib/claude/generate", () => ({
  generate: async () => ({
    text: "",
    inputTokens: 0,
    outputTokens: 0,
    durationMs: 0,
  }),
}));

import { generateHandover } from "@/lib/inngest/functions/generate-handover";
import {
  creators as creatorsTable,
  launchPackages as launchPackagesTable,
  generatedAssets as generatedAssetsTable,
  handoverDocuments as handoverDocumentsTable,
  handoverRuns as handoverRunsTable,
} from "@/lib/db/schema";
import {
  HANDOVER_GENERATED_DOC_KEYS,
} from "@/prompts/handover/deliverables";
import { REQUIRED_FOR_EXPORT } from "@/lib/modules/registry";

holder.launchPackages = launchPackagesTable;
holder.creators = creatorsTable;
holder.generatedAssets = generatedAssetsTable;
holder.handoverDocuments = handoverDocumentsTable;

const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const RUN_ID = "00000000-0000-4000-8000-0000000000bb";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const CREATOR_ID = "00000000-0000-4000-8000-0000000000cc";

/* ------------------------------ fixtures --------------------------------- */

const MODULE_CONTENT: Record<string, unknown> = {
  welcome_dm: { content: "Welcome #NAME# to #GROUPNAME#" },
  transformation: { candidates: ["Reclaim your power."] },
  about_us: {
    hero: "H",
    trial_callout: "T",
    value_buckets: [{ emoji: "*", header: "Hdr", items: ["one"] }],
    pricing: "Standard: $47/mo or $470/yr",
    refund_policy: "14-day refund",
  },
  start_here: {
    step_1_how_to_use: {
      title: "How",
      sections: [{ name: "N", description: "D" }],
    },
    step_2_community_rules: { title: "Rules", rules: ["be kind"] },
    step_3_faqs: [{ question: "Q", answer_template: "A" }],
    step_4_need_assistance: { title: "Help", template: "Ask" },
  },
  first_post: { title: "Hello", body: "Body" },
  classroom: { items: [{ title: "Module One", description: "Desc" }] },
  calendar: { events: [] },
  leaderboard: { levels: ["Seed", "Sprout"] },
  categories: { categories: ["Wins"] },
  discovery_seo: { keywords: ["skool"] },
};

function approvedAssets(approved: boolean) {
  return REQUIRED_FOR_EXPORT.map((module) => ({
    id: `asset-${module}`,
    packageId: PKG_ID,
    module,
    version: 1,
    content: MODULE_CONTENT[module],
    approved,
    createdBy: USER_ID,
    createdAt: new Date("2026-08-01T00:00:00Z"),
  }));
}

const CREATOR_ROW = {
  id: CREATOR_ID,
  name: "Jane Doe",
  communityName: "Sanctuary",
  niche: "spiritual",
  tone: "warm",
  transformation: "reclaim power",
  audience: "soul-led women",
  supportContact: "support@x.test",
  offerBreakdown: { perks: [], guest_sessions: false },
  pricing: { monthly: 47, annual: 470, additional_tiers: [] },
  trialTerms: { has_trial: false },
  refundPolicy: "14-day refund",
  brandPrefs: "",
};

const FILLER = Array.from({ length: 250 }, (_, i) => `word${i}`).join(" ");

/* --------------------------- handler plumbing ---------------------------- */

type HandlerCtx = {
  event: { name: string; data: Record<string, unknown> };
  step: { run: (id: string, fn: () => unknown) => Promise<unknown> };
  runId: string;
};

const handler = (
  generateHandover as unknown as { fn: (ctx: HandlerCtx) => Promise<unknown> }
).fn;

function invoke(overrides: Record<string, unknown> = {}) {
  return handler({
    event: {
      name: "handover.generate.requested",
      data: {
        packageId: PKG_ID,
        runId: RUN_ID,
        userId: USER_ID,
        includeGuestEmails: false,
        ...overrides,
      },
    },
    step: { run: async (_id, fn) => fn() },
    runId: "inngest-run-1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.calls.length = 0;
  state.inserted.length = 0;
  state.docs.length = 0;
  state.updates.length = 0;
  state.packages = [{ id: PKG_ID, creatorId: CREATOR_ID, totalCostUsd: "0" }];
  state.creators = [CREATOR_ROW];
  state.assets = approvedAssets(true);
  renderPdfsMock.mockResolvedValue({ rendered: 6 });
  // The user prompt names its deliverable ("## Your task — deliverable NN:"),
  // which is how each mocked Claude call identifies itself. Begin/end pairs
  // land in state.calls; the microtask+timer delay makes overlap observable.
  generateHandoverDocMock.mockImplementation(async ({ userMessage }) => {
    const num = /deliverable (\d{2})/.exec(userMessage)?.[1] ?? "??";
    state.calls.push(`begin:${num}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
    state.calls.push(`end:${num}`);
    const placeholder =
      num === "04" ? "[[CREATOR STORY: the real turning point]]\n\n" : "";
    return {
      text: `# Doc ${num}\n\n${placeholder}${FILLER}`,
      usage: {
        model: "claude-opus-4-8",
        inputTokens: 1000,
        outputTokens: 2000,
        cacheReadTokens: num === "01" ? 0 : 50_000,
        cacheWriteTokens: num === "01" ? 50_000 : 0,
        durationMs: 1234,
        costUsd: 0.5,
      },
    };
  });
});

/* -------------------------------- tests ---------------------------------- */

describe("generateHandover orchestrator", () => {
  test("(a) doc 01 completes before any of 02–05 begin; 02–05 run concurrently", async () => {
    await invoke();

    expect(generateHandoverDocMock).toHaveBeenCalledTimes(5);
    // Cache prime: the very first two events are 01's begin and end — nothing
    // else may interleave.
    expect(state.calls.slice(0, 2)).toEqual(["begin:01", "end:01"]);
    // The remaining four all BEGIN before any of them ends (fired inside
    // Promise.all, i.e. reading the cache concurrently).
    const rest = state.calls.slice(2);
    expect(rest.slice(0, 4).every((c) => c.startsWith("begin:"))).toBe(true);
    expect(rest.slice(4).every((c) => c.startsWith("end:"))).toBe(true);
    // Every deliverable ran exactly once.
    const begun = state.calls
      .filter((c) => c.startsWith("begin:"))
      .map((c) => c.slice("begin:".length))
      .sort();
    expect(begun).toEqual(["01", "02", "03", "04", "05"]);
  });

  test("(b) inserts 5 generated documents plus 1 readme", async () => {
    await invoke();

    expect(state.inserted).toHaveLength(6);
    expect(new Set(state.inserted.map((r) => r.docKey))).toEqual(
      new Set([...HANDOVER_GENERATED_DOC_KEYS, "readme"]),
    );
    // PDF render sees the full 6-doc run.
    expect(renderPdfsMock).toHaveBeenCalledTimes(1);
    const pdfArg = renderPdfsMock.mock.calls[0][0] as {
      packageId: string;
      runId: string;
      docs: unknown[];
    };
    expect(pdfArg.packageId).toBe(PKG_ID);
    expect(pdfArg.runId).toBe(RUN_ID);
    expect(pdfArg.docs).toHaveLength(6);
  });

  test("(c) readme checklist carries the scanned placeholder label", async () => {
    await invoke();

    const readme = state.inserted.find((r) => r.docKey === "readme");
    expect(readme).toBeDefined();
    // Doc 04's [[CREATOR STORY: the real turning point]] collapses to its
    // label before the colon.
    expect(readme?.contentMd).toContain("[[CREATOR STORY]]");
    expect(readme?.contentMd).not.toContain("the real turning point");
    // README counts unique labels, not raw token occurrences.
    expect(readme?.placeholderCount).toBe(1);
  });

  test("(d) finalize marks the run done with aggregated usage and increments package cost", async () => {
    const result = (await invoke()) as {
      runId: string;
      packageId: string;
      usage: { costUsd: number; model: string | null };
    };

    const running = state.updates.find((u) => u.payload.status === "running");
    expect(running?.table).toBe(handoverRunsTable);

    const done = state.updates.find((u) => u.payload.status === "done");
    expect(done?.table).toBe(handoverRunsTable);
    const aggregate = done?.payload.claudeUsage as {
      model: string;
      costUsd: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
    };
    // 5 generated docs at $0.50 each; the readme row has no usage.
    expect(aggregate.costUsd).toBe(2.5);
    expect(aggregate.model).toBe("claude-opus-4-8");
    expect(aggregate.cacheWriteTokens).toBe(50_000);
    expect(aggregate.cacheReadTokens).toBe(4 * 50_000);

    const pkgUpdate = state.updates.find(
      (u) => u.table === launchPackagesTable,
    );
    expect(pkgUpdate?.payload.totalCostUsd).toBeDefined();

    expect(result).toMatchObject({ runId: RUN_ID, packageId: PKG_ID });
    expect(result.usage.costUsd).toBe(2.5);

    const completedAudit = logAuditMock.mock.calls.find(
      (call) => call[1] === "handover.generate.completed",
    );
    expect(completedAudit).toBeDefined();
  });

  test("(e) load-source throws NonRetriableError when required modules are unapproved", async () => {
    state.assets = approvedAssets(false);

    await expect(invoke()).rejects.toBeInstanceOf(NonRetriableError);
    expect(generateHandoverDocMock).not.toHaveBeenCalled();
    expect(state.inserted).toHaveLength(0);
  });

  test("(e) the not-ready error names the missing modules", async () => {
    state.assets = approvedAssets(false);

    await expect(invoke()).rejects.toThrow(
      /not ready for handover — missing modules/,
    );
  });
});
