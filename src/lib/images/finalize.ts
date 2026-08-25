import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { imageAssets, imageRuns, launchPackages } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import type { ImageRunUsage } from "@/lib/images/usage";

/**
 * Close out an image run.
 *
 * Ported beat for beat from `src/lib/handover/finalize.ts`, including the
 * two properties that matter:
 *
 *   1. The done-transition is gated `WHERE status <> 'done'`, and the cost
 *      roll-up happens ONLY inside the `if (transitioned)` branch. An Inngest
 *      step retry that already committed therefore cannot double-charge the
 *      package.
 *   2. A run whose slots partly failed still finalizes as 'done', with
 *      `failedCount > 0` in the aggregate. Per-slot failure is surfaced on
 *      the slot card; it is not a run-level failure, because eleven good
 *      images and one bad one is a successful run with one image to redo.
 */
export async function finalizeImageRun(params: {
  runId: string;
  packageId: string;
  userId: string;
  action: string;
}): Promise<ImageRunUsage> {
  const rows = await db
    .select({
      status: imageAssets.status,
      costUsd: imageAssets.costUsd,
      durationMs: imageAssets.durationMs,
    })
    .from(imageAssets)
    .where(eq(imageAssets.runId, params.runId));

  const aggregate: ImageRunUsage = {
    imageCount: rows.length,
    doneCount: rows.filter((r) => r.status === "done").length,
    failedCount: rows.filter((r) => r.status === "failed").length,
    costUsd: Number(
      rows.reduce((sum, r) => sum + Number(r.costUsd ?? 0), 0).toFixed(6),
    ),
    durationMs: rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0),
  };

  const [transitioned] = await db
    .update(imageRuns)
    .set({
      status: "done",
      completedAt: new Date(),
      imageUsage: aggregate,
      // A run that reaches finalize has completed; a stale error string would
      // misreport it as failed in the poll payload.
      error: null,
    })
    .where(and(eq(imageRuns.id, params.runId), sql`${imageRuns.status} <> 'done'`))
    .returning({ id: imageRuns.id });

  if (transitioned) {
    await db
      .update(launchPackages)
      .set({
        totalCostUsd: sql`${launchPackages.totalCostUsd} + ${aggregate.costUsd}`,
      })
      .where(eq(launchPackages.id, params.packageId));
  }

  await logAudit(params.userId, params.action, "image_run", params.runId, {
    packageId: params.packageId,
    imageCount: aggregate.imageCount,
    doneCount: aggregate.doneCount,
    failedCount: aggregate.failedCount,
    costUsd: aggregate.costUsd,
    countedTowardPackageCost: Boolean(transitioned),
  });

  return aggregate;
}
