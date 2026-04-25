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
 * POST /api/packages/[id]/modules/[module]/approve
 *
 * Marks the latest generated_assets row for this (package, module) as approved.
 * Approve is one-way for the demo — there's no unapprove. (Re-running edit
 * resets approval; that's the only way back.)
 */

const UuidParam = z.string().uuid();

const ModuleParam = z.enum([
  "welcome_dm",
  "transformation",
  "about_us",
  "start_here",
  "cover",
]);

type RouteCtx = { params: Promise<{ id: string; module: string }> };

export async function POST(_req: NextRequest, { params }: RouteCtx) {
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

  // Own-row check (RLS bypassed by service role).
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

  // Latest asset for this module = highest version, then most recent createdAt.
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
      { error: `No ${modR.data} asset to approve.`, code: "not_found" },
      { status: 404 },
    );
  }

  const [updated] = await db
    .update(generatedAssets)
    .set({
      approved: true,
      approvedBy: user.id,
      approvedAt: new Date(),
    })
    .where(eq(generatedAssets.id, latest.id))
    .returning();

  await logAudit(
    user.id,
    `module.approve.${modR.data}`,
    "generated_asset",
    updated.id,
    { module: modR.data },
  );

  return NextResponse.json<GeneratedAsset>(updated);
}
