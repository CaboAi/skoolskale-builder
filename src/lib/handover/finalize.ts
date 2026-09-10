import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  handoverRuns,
  handoverDocuments,
  launchPackages,
  type HandoverDocument,
} from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";

/**
 * Closing step shared by the generation orchestrator and the PDF-only
 * retry: roll per-doc usage up onto the run, flip it to `done`, and add the
 * spend to launch_packages.totalCostUsd exactly once.
 *
 * Extracted so the retry path can complete a run that failed at rendering
 * without duplicating (or drifting from) the cost accounting.
 */

export type HandoverUsageAggregate = {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  costUsd: number;
};

export async function loadRunDocuments(
  runId: string,
): Promise<HandoverDocument[]> {
  return db
    .select()
    .from(handoverDocuments)
    .where(eq(handoverDocuments.runId, runId));
}

export function aggregateUsage(
  docs: HandoverDocument[],
): HandoverUsageAggregate {
  const usages = docs
    .map((d) => d.claudeUsage as Record<string, number> | null)
    .filter((u): u is Record<string, number> => u !== null);
  const sum = (key: string) =>
    usages.reduce((acc, u) => acc + (u[key] ?? 0), 0);
  return {
    model: (usages[0]?.model as unknown as string) ?? null,
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    cacheReadTokens: sum("cacheReadTokens"),
    cacheWriteTokens: sum("cacheWriteTokens"),
    durationMs: sum("durationMs"),
    costUsd: Number(sum("costUsd").toFixed(6)),
  };
}

export async function finalizeHandoverRun(params: {
  runId: string;
  packageId: string;
  userId: string;
  action: string;
}): Promise<HandoverUsageAggregate> {
  const docs = await loadRunDocuments(params.runId);
  const aggregate = aggregateUsage(docs);

  // Gate the done-transition so a step retry that already committed can't
  // double-add the cost: only the invocation that actually flips the run to
  // 'done' performs the increment. `error` is cleared because a run that
  // reaches here has completed — a stale message would misreport it as failed.
  const [transitioned] = await db
    .update(handoverRuns)
    .set({
      status: "done",
      completedAt: new Date(),
      claudeUsage: aggregate,
      error: null,
    })
    .where(
      and(
        eq(handoverRuns.id, params.runId),
        sql`${handoverRuns.status} <> 'done'`,
      ),
    )
    .returning({ id: handoverRuns.id });

  if (transitioned) {
    // First writer of launch_packages.totalCostUsd — the module pipeline
    // records per-job usage but never rolled it up.
    await db
      .update(launchPackages)
      .set({
        totalCostUsd: sql`${launchPackages.totalCostUsd} + ${aggregate.costUsd}`,
      })
      .where(eq(launchPackages.id, params.packageId));
  }

  await logAudit(params.userId, params.action, "handover_run", params.runId, {
    packageId: params.packageId,
    docCount: docs.length,
    costUsd: aggregate.costUsd,
    cacheReadTokens: aggregate.cacheReadTokens,
    countedTowardPackageCost: Boolean(transitioned),
  });
  return aggregate;
}
