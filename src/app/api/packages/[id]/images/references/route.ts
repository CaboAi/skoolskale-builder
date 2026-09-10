import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageReferences, launchPackages } from "@/lib/db/schema";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";
import { IMAGE_REFERENCES_BUCKET } from "@/lib/images/plan-source";

/**
 * POST   — record a reference image the client just uploaded.
 * DELETE — drop the current reference of a kind.
 *
 * The upload itself happens client-side against Supabase Storage (the bucket
 * policies allow authenticated inserts), so this route's real job is
 * validating that the claimed path belongs to THIS package before it is
 * persisted — otherwise a caller could point a package at any object in the
 * bucket.
 */

const UuidParam = z.string().uuid();

const PostBody = z.object({
  kind: z.enum(["headshot", "brand_kit"]),
  path: z.string().min(1).max(500),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const DeleteBody = z.object({ kind: z.enum(["headshot", "brand_kit"]) });

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
    body = PostBody.parse(await req.json());
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body.", code: "invalid_body" },
      { status: 400 },
    );
  }

  // The client picks the path, so the server must confirm it is inside this
  // package's prefix. Without this a caller could claim any object in the
  // bucket as their reference.
  if (!body.path.startsWith(`${packageId}/`)) {
    return NextResponse.json<ApiError>(
      {
        error: "Reference path must live under this package's prefix.",
        code: "invalid_path",
      },
      { status: 400 },
    );
  }

  const [pkg] = await db
    .select({ id: launchPackages.id })
    .from(launchPackages)
    .where(eq(launchPackages.id, packageId))
    .limit(1);
  if (!pkg) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  const [row] = await db
    .insert(imageReferences)
    .values({
      packageId,
      kind: body.kind,
      bucket: IMAGE_REFERENCES_BUCKET,
      path: body.path,
      mime: body.mime,
      createdBy: user.id,
    })
    .returning({ id: imageReferences.id });

  await logAudit(user.id, "images.reference.add", "image_reference", row.id, {
    packageId,
    kind: body.kind,
  });

  return NextResponse.json({ id: row.id, kind: body.kind }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
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

  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await req.json());
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body.", code: "invalid_body" },
      { status: 400 },
    );
  }

  const [current] = await db
    .select()
    .from(imageReferences)
    .where(
      and(
        eq(imageReferences.packageId, packageId),
        eq(imageReferences.kind, body.kind),
      ),
    )
    .orderBy(desc(imageReferences.createdAt))
    .limit(1);

  if (!current) {
    return NextResponse.json<ApiError>(
      { error: "No reference of that kind.", code: "not_found" },
      { status: 404 },
    );
  }

  const { error } = await createServiceClient()
    .storage.from(current.bucket)
    .remove([current.path]);
  if (error) {
    // The DB row is the source of truth for the pipeline; a stranded object
    // is tidier to leave than a dangling row pointing at nothing.
    console.warn(
      `[images/references] storage remove failed for ${current.path}: ${error.message}`,
    );
  }

  await db.delete(imageReferences).where(eq(imageReferences.id, current.id));

  await logAudit(
    user.id,
    "images.reference.remove",
    "image_reference",
    current.id,
    { packageId, kind: body.kind },
  );

  return NextResponse.json({ status: "deleted", kind: body.kind });
}
