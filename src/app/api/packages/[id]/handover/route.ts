import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  launchPackages,
  generatedAssets,
  handoverRuns,
  handoverDocuments,
} from "@/lib/db/schema";
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

  const assets = await db
    .select({
      module: generatedAssets.module,
      approved: generatedAssets.approved,
    })
    .from(generatedAssets)
    .where(eq(generatedAssets.packageId, packageId));
  const missing = getMissingRequiredModules(assets);
  if (missing.length > 0) {
    return NextResponse.json<ApiError>(
      {
        error: `Package is not ready for handover — unapproved modules: ${missing.join(", ")}.`,
        code: "not_ready",
      },
      { status: 409 },
    );
  }

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

  return NextResponse.json({
    run: run ?? null,
    documents: [...latestByDocKey.values()],
  });
}
