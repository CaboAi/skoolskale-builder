/**
 * Unit tests for aggregateUsage (src/lib/handover/finalize.ts).
 *
 * aggregateUsage is the cost-accounting seam shared by the generation
 * orchestrator and the PDF-only retry: it rolls per-doc Claude usage up onto
 * the run, and its output is what gets added to launch_packages.totalCostUsd.
 * A silent drift here misreports spend, so the expectations below are
 * pre-computed by hand from the fixture table rather than read back from the
 * function.
 *
 * The fixture mirrors a real production run: doc 01 writes the prompt cache
 * (cacheWrite > 0, cacheRead 0), docs 02–05 read it, and the README row has
 * no Claude usage at all because it is assembled locally.
 *
 * db is stubbed with the minimal `() => ({ db: {} })` shape per CLAUDE.md —
 * aggregateUsage is pure, but its module siblings open a postgres pool at
 * import time.
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { aggregateUsage } from "@/lib/handover/finalize";
import type { HandoverDocument } from "@/lib/db/schema";

const RUN_ID = "00000000-0000-4000-8000-0000000000bb";
const PKG_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const MODEL = "claude-opus-4-8";

type DocUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  costUsd: number;
};

/** Per-deliverable usage from the 2026-08 production run. */
const RUN_USAGE: Record<string, DocUsage> = {
  vsl_and_cancellation: {
    model: MODEL,
    inputTokens: 1_147,
    outputTokens: 8_213,
    cacheReadTokens: 0,
    cacheWriteTokens: 8_344,
    durationMs: 149_402,
    costUsd: 0.1384,
  },
  pre_launch_emails: {
    model: MODEL,
    inputTokens: 812,
    outputTokens: 7_468,
    cacheReadTokens: 8_344,
    cacheWriteTokens: 0,
    durationMs: 131_755,
    costUsd: 0.1266,
  },
  post_launch_emails: {
    model: MODEL,
    inputTokens: 795,
    outputTokens: 9_204,
    cacheReadTokens: 8_344,
    cacheWriteTokens: 0,
    durationMs: 168_930,
    costUsd: 0.155,
  },
  docuseries_full_script: {
    model: MODEL,
    inputTokens: 838,
    outputTokens: 6_861,
    cacheReadTokens: 8_344,
    cacheWriteTokens: 0,
    durationMs: 122_614,
    costUsd: 0.1164,
  },
  dm_sequences: {
    model: MODEL,
    inputTokens: 806,
    outputTokens: 6_402,
    cacheReadTokens: 8_344,
    cacheWriteTokens: 0,
    durationMs: 114_338,
    costUsd: 0.1088,
  },
};

/**
 * Column-wise totals of RUN_USAGE, added by hand:
 *   input   1147 + 812 + 795 + 838 + 806                    =  4_398
 *   output  8213 + 7468 + 9204 + 6861 + 6402                = 38_148
 *   cacheR  0 + 8344 × 4                                    = 33_376
 *   cacheW  8344 + 0 × 4                                    =  8_344
 *   ms      149402 + 131755 + 168930 + 122614 + 114338      = 687_039
 *   cost    .1384 + .1266 + .1550 + .1164 + .1088           = 0.6452
 */
const EXPECTED_TOTALS = {
  model: MODEL,
  inputTokens: 4_398,
  outputTokens: 38_148,
  cacheReadTokens: 33_376,
  cacheWriteTokens: 8_344,
  durationMs: 687_039,
  costUsd: 0.6452,
};

function docFixture(
  docKey: HandoverDocument["docKey"],
  claudeUsage: unknown,
): HandoverDocument {
  return {
    id: `doc-${docKey}`,
    runId: RUN_ID,
    packageId: PKG_ID,
    docKey,
    version: 1,
    contentMd: `# ${docKey}`,
    pdfPath: null,
    wordCount: 1,
    placeholderCount: 0,
    claudeUsage,
    createdBy: USER_ID,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
  };
}

/** The README row is inserted with claudeUsage null — it costs nothing. */
const README_DOC = docFixture("readme", null);

const GENERATED_DOCS = (
  Object.keys(RUN_USAGE) as HandoverDocument["docKey"][]
).map((docKey) => docFixture(docKey, RUN_USAGE[docKey]));

describe("aggregateUsage", () => {
  test("sums every usage field across a full 5-doc run", () => {
    expect(aggregateUsage(GENERATED_DOCS)).toEqual(EXPECTED_TOTALS);
  });

  test("a docs-with-no-usage row (readme) contributes nothing to the totals", () => {
    // README first AND last, to prove position is irrelevant to the sums.
    const withReadme = [README_DOC, ...GENERATED_DOCS, README_DOC];
    expect(aggregateUsage(withReadme)).toEqual(EXPECTED_TOTALS);
  });

  test("model comes from the first doc that has usage, not the first doc", () => {
    const haiku = { ...RUN_USAGE.dm_sequences, model: "claude-haiku-4-8" };
    const aggregate = aggregateUsage([
      README_DOC,
      docFixture("dm_sequences", haiku),
      docFixture("vsl_and_cancellation", RUN_USAGE.vsl_and_cancellation),
    ]);
    expect(aggregate.model).toBe("claude-haiku-4-8");
  });

  test("costUsd is rounded to 6dp, absorbing binary-float drift", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE-754; the run's stored cost
    // must not carry that tail into launch_packages.totalCostUsd.
    const drifting = [
      docFixture("vsl_and_cancellation", { ...RUN_USAGE.vsl_and_cancellation, costUsd: 0.1 }),
      docFixture("pre_launch_emails", { ...RUN_USAGE.pre_launch_emails, costUsd: 0.2 }),
    ];
    expect(aggregateUsage(drifting).costUsd).toBe(0.3);
  });

  test("costUsd rounds at the 6th decimal rather than truncating", () => {
    const precise = [
      docFixture("vsl_and_cancellation", {
        ...RUN_USAGE.vsl_and_cancellation,
        costUsd: 0.1234561,
      }),
      docFixture("pre_launch_emails", {
        ...RUN_USAGE.pre_launch_emails,
        costUsd: 0.0000008,
      }),
    ];
    // 0.1234561 + 0.0000008 = 0.1234569 → 0.123457 at 6dp (a truncating
    // implementation would report 0.123456).
    expect(aggregateUsage(precise).costUsd).toBe(0.123457);
  });

  test("a usage object missing a field treats it as zero rather than NaN", () => {
    const partial = [
      docFixture("vsl_and_cancellation", {
        model: MODEL,
        outputTokens: 500,
        costUsd: 0.02,
      }),
    ];
    expect(aggregateUsage(partial)).toEqual({
      model: MODEL,
      inputTokens: 0,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 0,
      costUsd: 0.02,
    });
  });

  test("no docs at all: every total is zero and model is null", () => {
    expect(aggregateUsage([])).toEqual({
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 0,
      costUsd: 0,
    });
  });

  test("docs that all lack usage: zero totals and a null model", () => {
    expect(aggregateUsage([README_DOC, README_DOC])).toEqual({
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 0,
      costUsd: 0,
    });
  });
});
