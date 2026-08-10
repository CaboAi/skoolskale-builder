import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  launchPackages,
  generatedAssets,
  handoverRuns,
  handoverDocuments,
} from "@/lib/db/schema";
import { pickLatestPerModule } from "@/lib/db/packages";
import { getMissingRequiredModules } from "@/lib/modules/registry";
import { inngest, Events } from "@/lib/inngest/client";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";

/**
 * POST /api/packages/[id]/handover — enqueue handover generation.
 * GET  /api/packages/[id]/handover — latest run + documents (poll endpoint).
 *
 * Per CLAUDE.md rule #1: no Claude calls from route handlers. POST inserts a
 * queued handover_runs row and hands off to Inngest.
 */

const UuidParam = z.string().uuid();

/**
 * Active runs older than this are presumed dead and get failed over by the
 * next POST. Must exceed the /api/inngest-handover maxDuration (800s) plus
 * queue slack; the UI's polling give-up (20 min) matches it. Not exported —
 * route files may only export handlers/config.
 */
const STALE_RUN_CUTOFF_MS = 20 * 60_000;

const PostBody = z.object({
  // Guest launch emails require explicit VA confirmation — never inferred
  // from the DNA's guest_sessions flag (the DFY recurring-defect rule).
  includeGuestEmails: z.boolean().optional().default(false),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }
  const packageId = idResult.data;

  let body: z.infer<typeof PostBody>;
  try {
    const raw = await req.json().catch(() => ({}));
    body = PostBody.parse(raw);
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body.", code: "invalid_body" },
      { status: 400 },
    );
  }

  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(eq(launchPackages.id, packageId))
    .limit(1);
  if (!pkg) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  // Latest-per-module, same "ready" definition as the export routes and
  // the orchestrator's load-source guard — a stale approved version must
  // not satisfy the check after a regeneration.
  const assetRows = await db
    .select()
    .from(generatedAssets)
    .where(eq(generatedAssets.packageId, packageId))
    .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt));
  const missing = getMissingRequiredModules(pickLatestPerModule(assetRows));
  if (missing.length > 0) {
    return NextResponse.json<ApiError>(
      {
        error: `Package is not ready for handover — unapproved modules: ${missing.join(", ")}.`,
        code: "not_ready",
      },
      { status: 409 },
    );
  }

  // A run that has been queued/running past the stale cutoff is treated as
  // dead: mark it failed and let this request proceed. Without this, a
  // dropped event or killed invocation that never reached onFailure
  // deadlocks the package (the exact stranded-state class PRs #47/#48
  // fixed for module regeneration). Cutoff sits above the handover serve
  // route's 800s maxDuration so a slow-but-live step can't be usurped.
  const staleBefore = new Date(Date.now() - STALE_RUN_CUTOFF_MS);
  await db
    .update(handoverRuns)
    .set({
      status: "failed",
      error: "run went unresponsive — superseded by a new generation request",
      completedAt: new Date(),
    })
    .where(
      and(
        eq(handoverRuns.packageId, packageId),
        inArray(handoverRuns.status, ["queued", "running"]),
        lt(handoverRuns.createdAt, staleBefore),
      ),
    );

  const [activeRun] = await db
    .select({ id: handoverRuns.id })
    .from(handoverRuns)
    .where(
      and(
        eq(handoverRuns.packageId, packageId),
        inArray(handoverRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (activeRun) {
    return NextResponse.json<ApiError>(
      { error: "A handover run is already in progress.", code: "already_running" },
      { status: 409 },
    );
  }

  const [run] = await db
    .insert(handoverRuns)
    .values({
      packageId,
      status: "queued",
      includeGuestEmails: body.includeGuestEmails,
      createdBy: user.id,
    })
    .returning({ id: handoverRuns.id });

  await inngest.send({
    name: Events.HandoverGenerateRequested,
    data: {
      packageId,
      runId: run.id,
      userId: user.id,
      includeGuestEmails: body.includeGuestEmails,
    },
  });

  await logAudit(user.id, "handover.generate", "handover_run", run.id, {
    packageId,
    includeGuestEmails: body.includeGuestEmails,
  });

  return NextResponse.json({ status: "queued", runId: run.id }, { status: 202 });
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }
  const packageId = idResult.data;

  const [run] = await db
    .select()
    .from(handoverRuns)
    .where(eq(handoverRuns.packageId, packageId))
    .orderBy(desc(handoverRuns.createdAt))
    .limit(1);

  // Latest document per docKey across ALL runs — so a failed rerun doesn't
  // hide the previous run's downloadable docs. contentMd is excluded from
  // the poll payload (it's tens of KB; downloads stream it separately).
  const docRows = await db
    .select({
      id: handoverDocuments.id,
      runId: handoverDocuments.runId,
      docKey: handoverDocuments.docKey,
      version: handoverDocuments.version,
      pdfPath: handoverDocuments.pdfPath,
      wordCount: handoverDocuments.wordCount,
      placeholderCount: handoverDocuments.placeholderCount,
      createdAt: handoverDocuments.createdAt,
    })
    .from(handoverDocuments)
    .where(eq(handoverDocuments.packageId, packageId))
    .orderBy(desc(handoverDocuments.version), desc(handoverDocuments.createdAt));
  const latestByDocKey = new Map<string, (typeof docRows)[number]>();
  for (const row of docRows) {
    if (!latestByDocKey.has(row.docKey)) latestByDocKey.set(row.docKey, row);
  }

  // A regeneration inserts new rows (pdfPath null) before its render step,
  // so the latest row alone would hide PDF links mid-run — but the PDF
  // download route serves the newest row that HAS a pdfPath. pdfAvailable
  // mirrors that route's behavior so the UI never hides a downloadable PDF.
  const docKeysWithPdf = new Set(
    docRows.filter((r) => r.pdfPath !== null).map((r) => r.docKey),
  );

  return NextResponse.json({
    run: run ?? null,
    documents: [...latestByDocKey.values()].map((doc) => ({
      ...doc,
      pdfAvailable: docKeysWithPdf.has(doc.docKey),
    })),
  });
}
