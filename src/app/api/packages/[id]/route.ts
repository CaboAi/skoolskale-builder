import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { launchPackages } from "@/lib/db/schema";
import { getPackageWithDetails } from "@/lib/db/packages";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { ApiError } from "@/lib/validation";

/**
 * GET /api/packages/[id] — return package + creator + generated_assets.
 *
 * Used by the dashboard page (server component) for the initial load and by
 * the client for polling after regenerate. Workspace-wide: any authenticated
 * VA can read any package so handoffs work.
 *
 * DELETE /api/packages/[id] — remove the package, every generated asset, and
 * every storage object under the package id prefix in both image buckets.
 * Workspace-wide per the access model — any authed VA can delete any package.
 */

const UuidParam = z.string().uuid();

type RouteCtx = { params: Promise<{ id: string }> };

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

  const details = await getPackageWithDetails(idResult.data);
  if (!details) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json(details);
}

/**
 * Image buckets that may hold files for this package. The path convention is
 * always `${packageId}/...`, so we list under that prefix and remove every
 * object. Files already gone are silently ignored by Supabase Storage's
 * remove() — no need to special-case.
 */
const IMAGE_BUCKETS = ["cover-variants", "image-variants"] as const;

async function purgeStorageForPackage(packageId: string) {
  const supabase = createServiceClient();
  for (const bucket of IMAGE_BUCKETS) {
    // Storage list() doesn't recurse — collect from the bucket root with
    // a prefix and from each sub-folder we know about (icon, classroom_cover,
    // calendar_cover). The cover-variants bucket is flat; image-variants
    // nests one level deeper.
    const { data: rootEntries, error: rootErr } = await supabase.storage
      .from(bucket)
      .list(packageId);
    if (rootErr) {
      console.warn(
        `[package.delete] list ${bucket}/${packageId} failed: ${rootErr.message}`,
      );
      continue;
    }
    if (!rootEntries) continue;

    const filesToRemove: string[] = [];
    for (const entry of rootEntries) {
      // Folders come back with `id: null, metadata: null`; files have metadata.
      if (entry.metadata) {
        filesToRemove.push(`${packageId}/${entry.name}`);
      } else {
        // Sub-folder — list its contents and add them.
        const { data: subEntries } = await supabase.storage
          .from(bucket)
          .list(`${packageId}/${entry.name}`);
        for (const sub of subEntries ?? []) {
          if (sub.metadata) {
            filesToRemove.push(`${packageId}/${entry.name}/${sub.name}`);
          }
        }
      }
    }

    if (filesToRemove.length === 0) continue;
    const { error: rmErr } = await supabase.storage
      .from(bucket)
      .remove(filesToRemove);
    if (rmErr) {
      console.warn(
        `[package.delete] remove ${bucket} (${filesToRemove.length} files) failed: ${rmErr.message}`,
      );
    }
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  // Existence check — workspace-wide. Storage cleanup is best-effort; we
  // proceed with the DB delete even if storage removal partially fails so
  // the user doesn't end up with a "stuck" package they can't retry.
  const [pkg] = await db
    .select({ id: launchPackages.id })
    .from(launchPackages)
    .where(eq(launchPackages.id, idResult.data))
    .limit(1);
  if (!pkg) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  await purgeStorageForPackage(idResult.data);

  // generated_assets and generation_jobs rows cascade via the FK on
  // launch_packages, so a single DELETE handles the entire family.
  await db.delete(launchPackages).where(eq(launchPackages.id, idResult.data));

  await logAudit(user.id, "package.delete", "package", idResult.data, null);

  return new NextResponse(null, { status: 204 });
}
