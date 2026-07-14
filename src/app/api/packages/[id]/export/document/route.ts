import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import { getMissingRequiredModules } from "@/lib/modules/registry";
import {
  serializePackageMarkdown,
  packageMarkdownFilename,
} from "@/lib/modules/serialize";
import type { ApiError } from "@/lib/validation";

/**
 * GET /api/packages/[id]/export/document
 *
 * Streams the whole launch package as one Markdown document (creator intake
 * DNA + every generated module) as a file attachment. Read-only — no
 * audit_log write, no exportedAt mutation; a download isn't a state change.
 *
 * Guarded like the export page: 409 unless every export-required module has an
 * approved asset. The page already redirects on that, so this is defense in
 * depth for a direct hit.
 */

const UuidParam = z.string().uuid();

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  await requireUser();
  const { id } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  const details = await getPackageWithDetails(idR.data);
  if (!details) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  const missing = getMissingRequiredModules(details.assets);
  if (missing.length > 0) {
    return NextResponse.json<ApiError>(
      {
        error: "Package is not export-ready — approve every module first.",
        code: "not_ready",
        details: { missing },
      },
      { status: 409 },
    );
  }

  const markdown = serializePackageMarkdown(details.creator, details.assets);
  const filename = packageMarkdownFilename(details.creator);

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
