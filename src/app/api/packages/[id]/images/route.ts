import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageAssets, imageRuns } from "@/lib/db/schema";
import { inngest, Events } from "@/lib/inngest/client";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import type { ApiError } from "@/lib/validation";
import {
  IMAGE_REFERENCES_BUCKET,
  IMAGE_SLOTS_BUCKET,
  loadImageSource,
  loadPinnedStyleSpec,
} from "@/lib/images/plan-source";
import { signPaths } from "@/lib/images/resolve-urls";

/**
 * POST /api/packages/[id]/images — enqueue a full image run.
 * GET  /api/packages/[id]/images — run + assets + plan (poll endpoint).
 *
 * Per CLAUDE.md rule #1: no provider calls from route handlers. POST inserts
 * a queued image_runs row and hands off to Inngest.
 */

const UuidParam = z.string().uuid();

/**
 * Active runs older than this are presumed dead and get failed over by the
 * next POST.
 *
 * NOT the handover module's 20 minutes. A full run is up to 12 serial
 * provider calls at ~60-150s each, so ~30 minutes is a HEALTHY run; 20 would
 * fail one over mid-flight and let a second run start alongside it. The UI's
 * poll give-up uses the same constant.
 */
const IMAGES_STALE_RUN_CUTOFF_MS = 45 * 60_000;

const PostBody = z.object({
  /** Optional explicit slot list; defaults to the planned auto set. */
  slotKeys: z.array(z.string().min(1)).max(25).optional(),
  note: z.string().max(1000).optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

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
    body = PostBody.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body.", code: "invalid_body" },
      { status: 400 },
    );
  }

  const source = await loadImageSource(packageId);
  if (!source) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  // Same readiness definition as the export routes and the handover pipeline:
  // the DNA the prompts are derived from has to be final before we spend
  // money rendering it.
  if (source.missingModules.length > 0) {
    return NextResponse.json<ApiError>(
      {
        error: `Package is not ready for images — unapproved modules: ${source.missingModules.join(", ")}.`,
        code: "not_ready",
      },
      { status: 409 },
    );
  }

  const pinned = await loadPinnedStyleSpec(packageId);
  if (!pinned) {
    return NextResponse.json<ApiError>(
      {
        error:
          "No art direction pinned for this package. Pin a style spec before generating images.",
        code: "no_style_spec",
      },
      { status: 409 },
    );
  }

  const planned = body.slotKeys?.length
    ? body.slotKeys.filter((key) =>
        [...source.plan.auto, ...source.plan.overflow].some(
          (s) => s.key === key,
        ),
      )
    : source.plan.auto.map((s) => s.key);

  if (planned.length === 0) {
    return NextResponse.json<ApiError>(
      { error: "No valid slots to generate.", code: "no_slots" },
      { status: 400 },
    );
  }

  // A run stuck past the cutoff is dead: fail it over so this request can
  // proceed rather than leaving the package permanently un-generatable.
  const cutoff = new Date(Date.now() - IMAGES_STALE_RUN_CUTOFF_MS);
  await db
    .update(imageRuns)
    .set({
      status: "failed",
      error: "superseded — run exceeded the stale cutoff without completing",
      completedAt: new Date(),
    })
    .where(
      and(
        eq(imageRuns.packageId, packageId),
        inArray(imageRuns.status, ["queued", "running"]),
        lt(imageRuns.createdAt, cutoff),
      ),
    );

  // Run-level exclusivity lives here, not in Inngest's concurrency setting.
  const [active] = await db
    .select({ id: imageRuns.id })
    .from(imageRuns)
    .where(
      and(
        eq(imageRuns.packageId, packageId),
        inArray(imageRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (active) {
    return NextResponse.json<ApiError>(
      {
        error: "An image run is already in progress for this package.",
        code: "already_running",
      },
      { status: 409 },
    );
  }

  const [run] = await db
    .insert(imageRuns)
    .values({
      packageId,
      styleSpecId: pinned.id,
      status: "queued",
      plannedSlotKeys: planned,
      createdBy: user.id,
    })
    .returning({ id: imageRuns.id });

  await inngest.send({
    name: Events.ImagesGenerateRequested,
    data: {
      packageId,
      runId: run.id,
      userId: user.id,
      slotKeys: planned,
      regenerateNote: body.note,
    },
  });

  await logAudit(user.id, "images.generate", "image_run", run.id, {
    packageId,
    slotCount: planned.length,
    styleSpecId: pinned.id,
  });

  return NextResponse.json(
    { status: "queued", runId: run.id, slotCount: planned.length },
    { status: 202 },
  );
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

  const source = await loadImageSource(packageId);
  if (!source) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  const [run] = await db
    .select()
    .from(imageRuns)
    .where(eq(imageRuns.packageId, packageId))
    .orderBy(desc(imageRuns.createdAt))
    .limit(1);

  // Latest version per slot across ALL runs — a failed rerun must not hide
  // the good image an earlier run produced.
  const assetRows = await db
    .select()
    .from(imageAssets)
    .where(eq(imageAssets.packageId, packageId))
    .orderBy(desc(imageAssets.version), desc(imageAssets.createdAt));

  const seen = new Set<string>();
  const latest = assetRows.filter((row) => {
    if (seen.has(row.slotKey)) return false;
    seen.add(row.slotKey);
    return true;
  });

  const [slotUrls, referenceUrls] = await Promise.all([
    signPaths(
      IMAGE_SLOTS_BUCKET,
      latest.map((a) => a.storagePath).filter((p): p is string => Boolean(p)),
    ),
    signPaths(
      IMAGE_REFERENCES_BUCKET,
      source.references.map((r) => r.path),
    ),
  ]);

  const pinned = await loadPinnedStyleSpec(packageId);

  return NextResponse.json({
    // `providerConfigured: false` lets the page explain itself instead of
    // failing with an opaque 500 once someone hits Generate.
    providerConfigured: Boolean(env.OPENAI_API_KEY),
    run: run
      ? {
          id: run.id,
          status: run.status,
          plannedSlotKeys: run.plannedSlotKeys,
          error: run.error,
          usage: run.imageUsage,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
        }
      : null,
    styleSpec: pinned,
    plan: source.plan,
    assets: latest.map((a) => ({
      id: a.id,
      slotKey: a.slotKey,
      slotKind: a.slotKind,
      slotIndex: a.slotIndex,
      slotTitle: a.slotTitle,
      status: a.status,
      version: a.version,
      width: a.width,
      height: a.height,
      error: a.error,
      createdAt: a.createdAt,
      // `prompt` is deliberately excluded: ~2KB per asset on a 4s poll is
      // pure waste. It stays available on the row for archaeology.
      url: a.storagePath ? (slotUrls.get(a.storagePath) ?? null) : null,
    })),
    references: source.references.map((r) => ({
      kind: r.kind,
      path: r.path,
      url: referenceUrls.get(r.path) ?? null,
    })),
  });
}
