import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { creators, imageAssets, launchPackages } from "@/lib/db/schema";
import {
  DOWNLOAD_REDIRECT_TTL_SECONDS,
  createSignedStorageUrl,
} from "@/lib/storage/signed-url";
import type { ApiError } from "@/lib/validation";
import { SLOT_KINDS, slotKey } from "@/lib/images/slots";
import { IMAGE_SLOTS_BUCKET } from "@/lib/images/plan-source";

/**
 * GET /api/packages/[id]/images/[slotKind]/[slotIndex]/download
 *
 * 302s to a short-lived signed URL carrying a download filename. Same shape
 * as the handover PDF route — a cross-origin `<a download>` is ignored by the
 * browser, so the Content-Disposition has to come from the signed URL itself.
 */

const UuidParam = z.string().uuid();
const SlotKindParam = z.enum(SLOT_KINDS);
const SlotIndexParam = z.coerce.number().int().min(0).max(50);

type RouteCtx = {
  params: Promise<{ id: string; slotKind: string; slotIndex: string }>;
};

export const dynamic = "force-dynamic";

function sanitizeForFilename(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return cleaned || "package";
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  await requireUser();
  const { id, slotKind, slotIndex } = await params;

  const idResult = UuidParam.safeParse(id);
  const kindResult = SlotKindParam.safeParse(slotKind);
  const indexResult = SlotIndexParam.safeParse(slotIndex);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }
  if (!kindResult.success || !indexResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Unknown image slot.", code: "unknown_slot" },
      { status: 400 },
    );
  }

  const packageId = idResult.data;
  const key = slotKey(kindResult.data, indexResult.data);

  const [asset] = await db
    .select()
    .from(imageAssets)
    .where(
      and(
        eq(imageAssets.packageId, packageId),
        eq(imageAssets.slotKey, key),
        eq(imageAssets.status, "done"),
      ),
    )
    .orderBy(desc(imageAssets.version), desc(imageAssets.createdAt))
    .limit(1);

  if (!asset?.storagePath) {
    return NextResponse.json<ApiError>(
      { error: "No generated image for that slot.", code: "not_found" },
      { status: 404 },
    );
  }

  const [row] = await db
    .select({ communityName: creators.communityName })
    .from(launchPackages)
    .innerJoin(creators, eq(creators.id, launchPackages.creatorId))
    .where(eq(launchPackages.id, packageId))
    .limit(1);

  const filename = `${sanitizeForFilename(row?.communityName ?? "package")}-${kindResult.data}-${indexResult.data + 1}-${asset.width}x${asset.height}.png`;

  const signedUrl = await createSignedStorageUrl(
    IMAGE_SLOTS_BUCKET,
    asset.storagePath,
    DOWNLOAD_REDIRECT_TTL_SECONDS,
    { download: filename },
  );

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
