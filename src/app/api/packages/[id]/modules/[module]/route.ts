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
import { MODULE_REGISTRY, MODULE_KEYS } from "@/lib/modules/registry";
import type { ApiError } from "@/lib/validation";

/**
 * PATCH /api/packages/[id]/modules/[module]
 *
 * VA-supplied content edit. Validates the payload against the module's
 * generation schema, increments the version, snapshots the previous version
 * into `edit_history`, and clears approval (the VA must re-approve after an
 * edit).
 *
 * The cover-specific branch (CoverPatchSchema + selected_variant_index)
 * was removed in chore/remove-image-generation. All remaining modules use
 * the registry's outputSchema for validation.
 */

const UuidParam = z.string().uuid();

const ModuleParam = z.enum(MODULE_KEYS);

const PatchSchema = z.object({
  content: z.unknown(),
});

type EditHistoryEntry = {
  version: number;
  content: unknown;
  authorId: string;
  editedAt: string;
};

type RouteCtx = { params: Promise<{ id: string; module: string }> };

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id, module } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  const modR = ModuleParam.safeParse(module);
  if (!modR.success) {
    return NextResponse.json<ApiError>(
      { error: `Unknown module '${module}'.`, code: "invalid_module" },
      { status: 400 },
    );
  }

  const raw = await req.json().catch(() => null);
  const bodyR = PatchSchema.safeParse(raw);
  if (!bodyR.success) {
    return NextResponse.json<ApiError>(
      { error: "Body must be { content: ... }.", code: "invalid_body" },
      { status: 400 },
    );
  }

  // Existence check — workspace-wide.
  const [pkg] = await db
    .select({ id: launchPackages.id })
    .from(launchPackages)
    .where(eq(launchPackages.id, idR.data))
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
        eq(generatedAssets.module, modR.data),
      ),
    )
    .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt))
    .limit(1);
  if (!latest) {
    return NextResponse.json<ApiError>(
      { error: `No ${modR.data} asset to edit.`, code: "not_found" },
      { status: 404 },
    );
  }

  // Validate the new content against the registered module schema.
  const schema = MODULE_REGISTRY[modR.data].outputSchema;
  const result = schema.safeParse(bodyR.data.content);
  if (!result.success) {
    return NextResponse.json<ApiError>(
      {
        error: "Content does not match module schema.",
        code: "invalid_content",
        details: result.error.flatten(),
      } as ApiError,
      { status: 400 },
    );
  }
  const nextContent: unknown = result.data;

  // Snapshot the previous version into edit_history, then bump.
  const prevHistory = (latest.editHistory as EditHistoryEntry[]) ?? [];
  const historyEntry: EditHistoryEntry = {
    version: latest.version,
    content: latest.content,
    authorId: user.id,
    editedAt: new Date().toISOString(),
  };

  const [updated] = await db
    .update(generatedAssets)
    .set({
      content: nextContent as object,
      version: latest.version + 1,
      editHistory: [...prevHistory, historyEntry],
      approved: false,
      approvedBy: null,
      approvedAt: null,
    })
    .where(eq(generatedAssets.id, latest.id))
    .returning();

  await logAudit(
    user.id,
    `module.edit.${modR.data}`,
    "generated_asset",
    updated.id,
    { module: modR.data, newVersion: updated.version },
  );

  return NextResponse.json<GeneratedAsset>(updated);
}
