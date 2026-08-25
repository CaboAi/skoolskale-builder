import { type NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageRuns } from "@/lib/db/schema";
import { inngest, Events } from "@/lib/inngest/client";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";
import { SLOT_KINDS, findSlot, slotKey } from "@/lib/images/slots";
import { loadImageSource, loadPinnedStyleSpec } from "@/lib/images/plan-source";

/**
 * POST /api/packages/[id]/images/[slotKind]/[slotIndex]/regenerate
 *
 * A single-slot run. Same table, same event, same exclusivity guard as a full
 * run — only `plannedSlotKeys` differs — so there is exactly one pipeline and
 * one poll shape to reason about. Overflow slots use this route too; being
 * past the cap is not a different kind of generation.
 */

const UuidParam = z.string().uuid();
const SlotKindParam = z.enum(SLOT_KINDS);
const SlotIndexParam = z.coerce.number().int().min(0).max(50);
const PostBody = z.object({ note: z.string().max(1000).optional() });

/** Same cutoff as the full-run route; see the comment there. */
const IMAGES_STALE_RUN_CUTOFF_MS = 45 * 60_000;

type RouteCtx = {
  params: Promise<{ id: string; slotKind: string; slotIndex: string }>;
};

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id, slotKind, slotIndex } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }
  const packageId = idResult.data;

  const kindResult = SlotKindParam.safeParse(slotKind);
  const indexResult = SlotIndexParam.safeParse(slotIndex);
  if (!kindResult.success || !indexResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Unknown image slot.", code: "unknown_slot" },
      { status: 400 },
    );
  }

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

  const key = slotKey(kindResult.data, indexResult.data);
  // Validated against the LIVE plan, so a slot whose classroom module was
  // deleted since the last run can't be regenerated into nothing.
  if (!findSlot(source.plan, key)) {
    return NextResponse.json<ApiError>(
      {
        error: `Slot ${key} does not exist in this package's current plan.`,
        code: "unknown_slot",
      },
      { status: 400 },
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
      plannedSlotKeys: [key],
      createdBy: user.id,
    })
    .returning({ id: imageRuns.id });

  await inngest.send({
    name: Events.ImagesGenerateRequested,
    data: {
      packageId,
      runId: run.id,
      userId: user.id,
      slotKeys: [key],
      regenerateNote: body.note,
    },
  });

  await logAudit(user.id, `images.regenerate.${kindResult.data}`, "image_run", run.id, {
    packageId,
    slotKey: key,
    note: body.note,
  });

  return NextResponse.json(
    { status: "queued", runId: run.id, slotKey: key },
    { status: 202 },
  );
}
