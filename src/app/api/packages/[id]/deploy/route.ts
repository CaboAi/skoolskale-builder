import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { launchPackages, type LaunchPackage } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";

/**
 * POST /api/packages/[id]/deploy
 *
 * Marks a package as deployed. Final step of the demo flow — the VA has
 * pasted everything into Skool and is closing out the launch. We don't
 * verify "all approved" here; the export page guards that on the way in.
 */

const UuidParam = z.string().uuid();

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  // Existence check — workspace-wide, any VA can deploy any package.
  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(eq(launchPackages.id, idR.data))
    .limit(1);
  if (!pkg) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  const [updated] = await db
    .update(launchPackages)
    .set({ status: "deployed", deployedAt: new Date() })
    .where(eq(launchPackages.id, idR.data))
    .returning();

  await logAudit(user.id, "package.deploy", "package", updated.id, null);

  return NextResponse.json<LaunchPackage>(updated);
}
