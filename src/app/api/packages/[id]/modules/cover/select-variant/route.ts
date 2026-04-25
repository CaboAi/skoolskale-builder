import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generatedAssets,
  launchPackages,
  type GeneratedAsset,
} from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";

/**
 * PUT /api/packages/[id]/modules/cover/select-variant
 *
 * Sets `content.selected_variant_index` on the latest cover asset. This is a
 * presentation choice, NOT a content edit, so:
 *   - approval state is preserved (no `approved=false` reset)
 *   - the version is NOT bumped
 *   - edit_history is NOT appended
 *
 * The general PATCH /modules/[module] endpoint is for actual content changes
 * and intentionally invalidates approval. Variant selection deserves its own
 * verb.
 */

const UuidParam = z.string().uuid();

const BodySchema = z.object({
  index: z.number().int().min(0),
});

type CoverContent = {
  variants: { url: string; index: number }[];
  selected_variant_index?: number;
};

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  const raw = await req.json().catch(() => null);
  const bodyR = BodySchema.safeParse(raw);
  if (!bodyR.success) {
    return NextResponse.json<ApiError>(
      { error: "Body must be { index: number }.", code: "invalid_body" },
      { status: 400 },
    );
  }

  // Owner check.
  const [pkg] = await db
    .select({ id: launchPackages.id })
    .from(launchPackages)
    .where(
      and(
        eq(launchPackages.id, idR.data),
        eq(launchPackages.createdBy, user.id),
      ),
    )
    .limit(1);
  if (!pkg) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  // Latest cover asset.
  const [latest] = await db
    .select()
    .from(generatedAssets)
    .where(
      and(
        eq(generatedAssets.packageId, idR.data),
        eq(generatedAssets.module, "cover"),
      ),
    )
    .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt))
    .limit(1);
  if (!latest) {
    return NextResponse.json<ApiError>(
      { error: "No cover asset to select from.", code: "not_found" },
      { status: 404 },
    );
  }

  const current = latest.content as CoverContent;
  if (bodyR.data.index >= current.variants.length) {
    return NextResponse.json<ApiError>(
      { error: "Variant index out of range.", code: "invalid_index" },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(generatedAssets)
    .set({
      content: { ...current, selected_variant_index: bodyR.data.index },
    })
    .where(eq(generatedAssets.id, latest.id))
    .returning();

  await logAudit(
    user.id,
    "module.cover.select_variant",
    "generated_asset",
    updated.id,
    { index: bodyR.data.index },
  );

  return NextResponse.json<GeneratedAsset>(updated);
}
