import { and, desc, eq, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { inngestHandover, Events } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import {
  creators,
  launchPackages,
  handoverRuns,
  handoverDocuments,
  type HandoverDocument,
} from "@/lib/db/schema";
import { getMissingRequiredModules } from "@/lib/modules/registry";
import { serializePackageMarkdown } from "@/lib/modules/serialize";
import { pickLatestPerModule } from "@/lib/db/packages";
import { generatedAssets } from "@/lib/inngest/functions/_shared";
import { logAudit } from "@/lib/audit";
import { generateHandoverDoc } from "@/lib/claude/generate-handover";
import {
  HANDOVER_DELIVERABLES,
  HANDOVER_DOC_FILENAMES,
  type HandoverDeliverable,
} from "@/prompts/handover/deliverables";
import { buildHandoverBrief, type HandoverBrief } from "@/prompts/handover/brief";
import { buildHandoverSystemBlocks } from "@/prompts/handover/system-blocks";
import { buildHandoverUserPrompt } from "@/prompts/handover/user-prompt";
import { parseHandoverDoc } from "@/prompts/handover/parse";
import { scanPlaceholders } from "@/prompts/handover/scan-placeholders";
import { buildHandoverReadme } from "@/prompts/handover/readme";
import {
  loadHandoverAsset,
  assertHandoverAssets,
} from "@/prompts/handover/load-assets";
import { renderHandoverDocPdfs } from "@/lib/handover/pdf-step";

export type HandoverEventData = {
  packageId: string;
  runId: string;
  userId: string;
  includeGuestEmails: boolean;
};

type HandoverSource = {
  brief: HandoverBrief;
  dnaMarkdown: string;
};

/** Mirror of nextAssetVersion for the handover_documents table. */
async function nextHandoverDocVersion(
  packageId: string,
  docKey: HandoverDocument["docKey"],
): Promise<number> {
  const [row] = await db
    .select({ version: handoverDocuments.version })
    .from(handoverDocuments)
    .where(
      and(
        eq(handoverDocuments.packageId, packageId),
        eq(handoverDocuments.docKey, docKey),
      ),
    )
    .orderBy(desc(handoverDocuments.version))
    .limit(1);
  return (row?.version ?? 0) + 1;
}

/**
 * One deliverable: build prompts, call Opus, parse, persist. Runs inside a
 * memoized step — a retry re-fires the Claude call (reading the prompt
 * cache) and re-inserts; completed steps never re-run.
 */
async function generateDeliverable(params: {
  deliverable: HandoverDeliverable;
  source: HandoverSource;
  data: HandoverEventData;
}): Promise<{ docId: string }> {
  const { deliverable, source, data } = params;
  const systemBlocks = buildHandoverSystemBlocks({
    brief: source.brief,
    dnaMarkdown: source.dnaMarkdown,
    guardrailsText: loadHandoverAsset("voice-and-guardrails.md"),
    structureText: loadHandoverAsset("handover-structure.md"),
  });
  const userMessage = buildHandoverUserPrompt({
    deliverable,
    referenceText: loadHandoverAsset(deliverable.referenceAsset),
    templateTexts: deliverable
      .templateAssets(data.includeGuestEmails)
      .map(loadHandoverAsset),
    includeGuestEmails: data.includeGuestEmails,
  });

  const { text, usage } = await generateHandoverDoc({
    systemBlocks,
    userMessage,
  });
  const parsed = parseHandoverDoc(text);

  const [doc] = await db
    .insert(handoverDocuments)
    .values({
      runId: data.runId,
      packageId: data.packageId,
      docKey: deliverable.docKey,
      version: await nextHandoverDocVersion(data.packageId, deliverable.docKey),
      contentMd: parsed.contentMd,
      wordCount: parsed.wordCount,
      placeholderCount: parsed.placeholderCount,
      claudeUsage: usage,
      createdBy: data.userId,
    })
    .returning({ id: handoverDocuments.id });
  return { docId: doc.id };
}

async function loadRunDocuments(runId: string): Promise<HandoverDocument[]> {
  return db
    .select()
    .from(handoverDocuments)
    .where(eq(handoverDocuments.runId, runId));
}

/**
 * Orchestrator for the full handover package. Single function with
 * `step.run` per deliverable (not per-doc sub-functions): the
 * cache-prime-then-parallel ordering the DFY CLI proved out is expressed
 * directly — deliverable 01 runs ALONE to write the Anthropic prompt cache,
 * then the remaining 4 fire concurrently as cache reads. Doc content flows
 * through the DB, not step results, keeping Inngest state small.
 */
export const generateHandover = inngestHandover.createFunction(
  {
    id: "generate-handover",
    name: "Generate handover package",
    retries: 3,
    concurrency: [{ limit: 1, key: "event.data.packageId" }],
    triggers: [{ event: Events.HandoverGenerateRequested }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: HandoverEventData } })
        .event?.data;
      if (!data?.runId) return;
      await db
        .update(handoverRuns)
        .set({
          status: "failed",
          error: (error?.message ?? "unknown error").slice(0, 1000),
          completedAt: new Date(),
        })
        .where(eq(handoverRuns.id, data.runId));
      await logAudit(
        data.userId,
        "handover.generate.failed",
        "handover_run",
        data.runId,
        { packageId: data.packageId, error: error?.message },
      );
    },
  },
  async ({ event, step, runId: inngestRunId }) => {
    const data = event.data as HandoverEventData;

    await step.run("mark-running", async () => {
      await db
        .update(handoverRuns)
        .set({ status: "running", startedAt: new Date(), inngestRunId })
        .where(eq(handoverRuns.id, data.runId));
    });

    const source = (await step.run("load-source", async () => {
      assertHandoverAssets();

      const [pkg] = await db
        .select()
        .from(launchPackages)
        .where(eq(launchPackages.id, data.packageId))
        .limit(1);
      if (!pkg) {
        throw new NonRetriableError(`launch_package ${data.packageId} not found`);
      }
      const [creator] = await db
        .select()
        .from(creators)
        .where(eq(creators.id, pkg.creatorId))
        .limit(1);
      if (!creator) {
        throw new NonRetriableError(`creator ${pkg.creatorId} not found`);
      }
      const assetRows = await db
        .select()
        .from(generatedAssets)
        .where(eq(generatedAssets.packageId, pkg.id))
        .orderBy(
          desc(generatedAssets.version),
          desc(generatedAssets.createdAt),
        );
      const assets = pickLatestPerModule(assetRows);

      const missing = getMissingRequiredModules(assets);
      if (missing.length > 0) {
        throw new NonRetriableError(
          `package not ready for handover — missing modules: ${missing.join(", ")}`,
        );
      }

      return {
        brief: buildHandoverBrief(creator, assets),
        dnaMarkdown: serializePackageMarkdown(creator, assets),
      } satisfies HandoverSource;
    })) as HandoverSource;

    // Deliverable 01 alone first — it writes the shared prompt-cache prefix.
    const [first, ...rest] = HANDOVER_DELIVERABLES;
    await step.run(stepIdFor(first), () =>
      generateDeliverable({ deliverable: first, source, data }),
    );

    // The rest run concurrently; every call reads the cache at ~10% price.
    await Promise.all(
      rest.map((deliverable) =>
        step.run(stepIdFor(deliverable), () =>
          generateDeliverable({ deliverable, source, data }),
        ),
      ),
    );

    await step.run("build-readme", async () => {
      const docs = await loadRunDocuments(data.runId);
      const labels = scanPlaceholders(docs);
      const dateStr = new Date().toISOString().slice(0, 10);
      const contentMd = buildHandoverReadme(source.brief, labels, dateStr);
      const [doc] = await db
        .insert(handoverDocuments)
        .values({
          runId: data.runId,
          packageId: data.packageId,
          docKey: "readme",
          version: await nextHandoverDocVersion(data.packageId, "readme"),
          contentMd,
          wordCount: (contentMd.match(/\S+/g) ?? []).length,
          // The README's checklist tokens ARE the fill-list; count the
          // unique labels rather than the raw token occurrences.
          placeholderCount: labels.length,
          createdBy: data.userId,
        })
        .returning({ id: handoverDocuments.id });
      return { docId: doc.id, placeholders: labels.length };
    });

    await step.run("render-pdfs", async () => {
      const docs = await loadRunDocuments(data.runId);
      return renderHandoverDocPdfs({
        packageId: data.packageId,
        runId: data.runId,
        docs,
      });
    });

    const totals = await step.run("finalize", async () => {
      const docs = await loadRunDocuments(data.runId);
      const usages = docs
        .map((d) => d.claudeUsage as Record<string, number> | null)
        .filter((u): u is Record<string, number> => u !== null);
      const sum = (key: string) =>
        usages.reduce((acc, u) => acc + (u[key] ?? 0), 0);
      const aggregate = {
        model: usages[0]?.model ?? null,
        inputTokens: sum("inputTokens"),
        outputTokens: sum("outputTokens"),
        cacheReadTokens: sum("cacheReadTokens"),
        cacheWriteTokens: sum("cacheWriteTokens"),
        durationMs: sum("durationMs"),
        costUsd: Number(sum("costUsd").toFixed(6)),
      };

      // Gate the done-transition so a step retry that already committed
      // can't double-add the cost: only the invocation that flips the run
      // to 'done' performs the increment.
      const [transitioned] = await db
        .update(handoverRuns)
        .set({
          status: "done",
          completedAt: new Date(),
          claudeUsage: aggregate,
        })
        .where(
          and(
            eq(handoverRuns.id, data.runId),
            sql`${handoverRuns.status} <> 'done'`,
          ),
        )
        .returning({ id: handoverRuns.id });

      if (transitioned) {
        // First writer of launch_packages.totalCostUsd — the module
        // pipeline records per-job usage but never rolled it up.
        await db
          .update(launchPackages)
          .set({
            totalCostUsd: sql`${launchPackages.totalCostUsd} + ${aggregate.costUsd}`,
          })
          .where(eq(launchPackages.id, data.packageId));
      }

      await logAudit(
        data.userId,
        "handover.generate.completed",
        "handover_run",
        data.runId,
        {
          packageId: data.packageId,
          docCount: docs.length,
          costUsd: aggregate.costUsd,
          cacheReadTokens: aggregate.cacheReadTokens,
        },
      );
      return aggregate;
    });

    return { runId: data.runId, packageId: data.packageId, usage: totals };
  },
);

function stepIdFor(d: HandoverDeliverable): string {
  return `generate-${HANDOVER_DOC_FILENAMES[d.docKey].replace(/\.md$/, "")}`;
}
