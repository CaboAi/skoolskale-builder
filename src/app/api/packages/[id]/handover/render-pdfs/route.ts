import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handoverRuns, handoverDocuments } from "@/lib/db/schema";
import { inngest, Events } from "@/lib/inngest/client";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";

/**
 * POST /api/packages/[id]/handover/render-pdfs
 *
 * Re-render PDFs from the documents a previous run already produced, with
 * no Claude spend. Generation costs ~$0.65 of Opus per package while
 * rendering is free, so a run that produced all its copy and then died in
 * the render step must not require paying to regenerate identical text.
 */

const UuidParam = z.string().uuid();

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteCtx) {
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
      {
        error: "A handover run is already in progress.",
        code: "already_running",
      },
      { status: 409 },
    );
  }

  // Newest run that actually has documents — an empty run (failed before or
  // during generation) has nothing to render and would only fail again.
  const [target] = await db
    .select({ runId: handoverDocuments.runId })
    .from(handoverDocuments)
    .where(eq(handoverDocuments.packageId, packageId))
    .orderBy(desc(handoverDocuments.createdAt))
    .limit(1);
  if (!target) {
    return NextResponse.json<ApiError>(
      {
        error: "No generated handover documents to render. Generate first.",
        code: "no_documents",
      },
      { status: 409 },
    );
  }

  await inngest.send({
    name: Events.HandoverPdfsRequested,
    data: { packageId, runId: target.runId, userId: user.id },
  });

  await logAudit(user.id, "handover.pdfs", "handover_run", target.runId, {
    packageId,
  });

  return NextResponse.json(
    { status: "queued", runId: target.runId },
    { status: 202 },
  );
}
