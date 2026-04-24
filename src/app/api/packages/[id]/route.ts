import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import type { ApiError } from "@/lib/validation";

/**
 * GET /api/packages/[id] — return package + creator + generated_assets.
 *
 * Used by the dashboard page (server component) for the initial load and by
 * the client for polling after regenerate. RLS enforces ownership; we also
 * scope the query explicitly via createdBy in getPackageWithDetails as
 * defense-in-depth.
 */

const UuidParam = z.string().uuid();

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const user = await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  const details = await getPackageWithDetails(idResult.data, user.id);
  if (!details) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json(details);
}
