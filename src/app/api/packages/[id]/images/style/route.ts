import { type NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageRuns, imageStyleSpecs } from "@/lib/db/schema";
import { inngest, Events } from "@/lib/inngest/client";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";
import { ImageStyleSpecSchema } from "@/lib/images/style-spec";
import {
  loadImageSource,
  loadPinnedStyleSpec,
  nextStyleSpecVersion,
} from "@/lib/images/plan-source";

/**
 * POST   — enqueue derivation of the art direction (one OpenAI call).
 * PATCH  — persist a VA edit as a NEW version.
 * GET    — the currently pinned spec.
 */

const UuidParam = z.string().uuid();
const PatchBody = z.object({ spec: z.unknown() });

type RouteCtx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

async function hasActiveRun(packageId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: imageRuns.id })
    .from(imageRuns)
    .where(
      and(
        eq(imageRuns.packageId, packageId),
        inArray(imageRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

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

  const source = await loadImageSource(packageId);
  if (!source) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  // Re-pinning mid-run would leave half the images on one art direction and
  // half on another — the exact failure this phase exists to prevent.
  if (await hasActiveRun(packageId)) {
    return NextResponse.json<ApiError>(
      {
        error:
          "An image run is in progress. Wait for it to finish before changing the art direction.",
        code: "already_running",
      },
      { status: 409 },
    );
  }

  await inngest.send({
    name: Events.ImagesStyleRequested,
    data: { packageId, userId: user.id },
  });

  await logAudit(user.id, "images.style.requested", "launch_package", packageId, {});

  return NextResponse.json({ status: "queued" }, { status: 202 });
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
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

  let raw: unknown;
  try {
    raw = PatchBody.parse(await req.json()).spec;
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body.", code: "invalid_body" },
      { status: 400 },
    );
  }

  const parsed = ImageStyleSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json<ApiError>(
      {
        error: "Style spec failed validation.",
        code: "invalid_spec",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  // New version, never an update in place: the version history is how you
  // answer "which spec produced this image" months later.
  const [row] = await db
    .insert(imageStyleSpecs)
    .values({
      packageId,
      version: await nextStyleSpecVersion(packageId),
      spec: parsed.data,
      source: "edited",
      createdBy: user.id,
    })
    .returning({ id: imageStyleSpecs.id, version: imageStyleSpecs.version });

  await logAudit(user.id, "images.style.edit", "image_style_spec", row.id, {
    packageId,
    version: row.version,
  });

  return NextResponse.json({ id: row.id, version: row.version, spec: parsed.data });
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

  const pinned = await loadPinnedStyleSpec(idResult.data);
  return NextResponse.json({ styleSpec: pinned });
}
