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
import { MODULE_KEYS, MODULE_REGISTRY } from "@/lib/modules/registry";

/**
 * PUT /api/packages/[id]/modules/[module]/select-variant
 *
 * Sets `content.selected_variant_index` on the latest asset for the
 * module. This is a presentation choice, NOT a content edit, so:
 *   - approval state is preserved (no `approved=false` reset)
 *   - the version is NOT bumped
 *   - edit_history is NOT appended
 *
 * Gated by `MODULE_REGISTRY[module].hasVariants === true`. Modules
 * without variants (any text module, classroom_cover, calendar_cover)
 * return 400.
 *
 * Replaces the cover-specific route from PR #6.
 */

const UuidParam = z.string().uuid();
const ModuleParam = z.enum(MODULE_KEYS);

const BodySchema = z.object({
  index: z.number().int().min(0),
});

type ImageVariantsContent = {
  variants: { url: string; index: number }[];
  selected_variant_index?: number;
};

type RouteCtx = { params: Promise<{ id: string; module: string }> };

export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id, module } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  const moduleR = ModuleParam.safeParse(module);
  if (!moduleR.success) {
    return NextResponse.json<ApiError>(
      { error: "Unknown module.", code: "invalid_module" },
      { status: 400 },
    );
  }

  if (!MODULE_REGISTRY[moduleR.data].hasVariants) {
    return NextResponse.json<ApiError>(
      {
        error: `Module ${moduleR.data} does not support variant selection.`,
        code: "no_variants",
      },
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

  // Latest asset for this module.
  const [latest] = await db
    .select()
    .from(generatedAssets)
    .where(
      and(
        eq(generatedAssets.packageId, idR.data),
        eq(generatedAssets.module, moduleR.data),
      ),
    )
    .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt))
    .limit(1);
  if (!latest) {
    return NextResponse.json<ApiError>(
      {
        error: `No ${moduleR.data} asset to select from.`,
        code: "not_found",
      },
      { status: 404 },
    );
  }

  const current = latest.content as ImageVariantsContent;
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
    `module.${moduleR.data}.select_variant`,
    "generated_asset",
    updated.id,
    { index: bodyR.data.index },
  );

  return NextResponse.json<GeneratedAsset>(updated);
}
