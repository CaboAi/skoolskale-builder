import { eq } from "drizzle-orm";
import { inngestHandover, Events } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { handoverRuns } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { renderHandoverDocPdfs } from "@/lib/handover/pdf-step";
import { finalizeHandoverRun, loadRunDocuments } from "@/lib/handover/finalize";

export type HandoverPdfEventData = {
  packageId: string;
  runId: string;
  userId: string;
};

/**
 * PDF-only retry for a run whose documents already exist.
 *
 * Generation is the expensive half (~$0.65 of Opus per package); rendering
 * is free and local. When a run produces all its copy and then dies in the
 * render step — a Chromium/bundler problem, an OOM, a storage blip — this
 * re-renders from the stored markdown instead of paying to regenerate
 * identical text. On success the run is finalized normally, so a run that
 * failed at rendering ends up genuinely complete rather than stuck showing
 * an error it has since recovered from.
 */
export const renderHandoverPdfs = inngestHandover.createFunction(
  {
    id: "render-handover-pdfs",
    name: "Render handover PDFs",
    retries: 2,
    concurrency: [{ limit: 1, key: "event.data.packageId" }],
    triggers: [{ event: Events.HandoverPdfsRequested }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: HandoverPdfEventData } })
        .event?.data;
      if (!data?.runId) return;
      await db
        .update(handoverRuns)
        .set({
          status: "failed",
          error: `PDF render retry failed: ${(error?.message ?? "unknown error").slice(0, 950)}`,
          completedAt: new Date(),
        })
        .where(eq(handoverRuns.id, data.runId));
      await logAudit(
        data.userId,
        "handover.pdfs.failed",
        "handover_run",
        data.runId,
        { packageId: data.packageId, error: error?.message },
      );
    },
  },
  async ({ event, step }) => {
    const data = event.data as HandoverPdfEventData;

    await step.run("mark-running", async () => {
      await db
        .update(handoverRuns)
        .set({ status: "running", error: null })
        .where(eq(handoverRuns.id, data.runId));
    });

    const rendered = await step.run("render-pdfs", async () => {
      const docs = await loadRunDocuments(data.runId);
      if (docs.length === 0) {
        // Nothing to render — treated as terminal rather than retried, since
        // no amount of retrying will conjure documents for this run.
        throw new Error(`handover run ${data.runId} has no documents`);
      }
      return renderHandoverDocPdfs({
        packageId: data.packageId,
        runId: data.runId,
        docs,
      });
    });

    const usage = await step.run("finalize", () =>
      finalizeHandoverRun({
        runId: data.runId,
        packageId: data.packageId,
        userId: data.userId,
        action: "handover.pdfs.completed",
      }),
    );

    return { runId: data.runId, rendered, usage };
  },
);
