import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetailsRaw } from "@/lib/db/packages";
import {
  createSignedStorageUrl,
  DOWNLOAD_REDIRECT_TTL_SECONDS,
} from "@/lib/storage/signed-url";
import {
  isImageModule,
  MODULE_BUCKETS,
  type ImageModuleKey,
} from "@/lib/storage/module-buckets";
import type { ApiError } from "@/lib/validation";

/**
 * GET /api/packages/[id]/assets/[module]/[index]/download
 *
 * Re-signs the requested variant's storage object with a 60s TTL and 302s
 * the client to the signed URL. The `?download=<filename>` option on the
 * signed URL coerces Supabase Storage to return Content-Disposition:
 * attachment so the browser triggers a real download instead of opening
 * the asset in a tab (cross-origin <a download> is otherwise ignored).
 *
 * Auth is workspace-wide — any authenticated VA can download from any
 * package, matching the read model in getPackageWithDetails.
 *
 * Always re-signs on every request — never cache.
 */

// Each click re-signs; the redirect itself must never be cached.
export const dynamic = "force-dynamic";

const UuidParam = z.string().uuid();
const IndexParam = z.coerce.number().int().min(0);

type VariantWithPath = {
  url?: string | null;
  storagePath?: string | null;
  index: number;
};

type ImageContent = {
  variants: VariantWithPath[];
  selected_variant_index?: number;
};

type RouteCtx = {
  params: Promise<{ id: string; module: string; index: string }>;
};

/**
 * Sanitize a community name for use inside a download filename. Strips
 * filesystem-hostile characters, collapses whitespace, lowercases, and
 * clamps length. Fallback "package" is used if the input is empty after
 * sanitization (e.g. all special chars).
 */
function sanitizeForFilename(input: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : "package";
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  await requireUser();
  const { id, module, index } = await params;

  const idR = UuidParam.safeParse(id);
  if (!idR.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id.", code: "invalid_id" },
      { status: 400 },
    );
  }

  if (!isImageModule(module)) {
    return NextResponse.json<ApiError>(
      { error: `Module '${module}' is not an image module.`, code: "invalid_module" },
      { status: 400 },
    );
  }

  const idxR = IndexParam.safeParse(index);
  if (!idxR.success) {
    return NextResponse.json<ApiError>(
      { error: "Index must be a non-negative integer.", code: "invalid_index" },
      { status: 400 },
    );
  }

  const details = await getPackageWithDetailsRaw(idR.data);
  if (!details) {
    return NextResponse.json<ApiError>(
      { error: "Package not found.", code: "not_found" },
      { status: 404 },
    );
  }

  // There may be multiple historical rows per module (regenerations append
  // new asset rows rather than overwriting). The export view and dashboard
  // both render the latest row, so we pick the latest by createdAt to match.
  const moduleAssets = details.assets
    .filter((a) => a.module === module)
    .sort((a, b) => +b.createdAt - +a.createdAt);
  const asset = moduleAssets[0];
  if (!asset) {
    return NextResponse.json<ApiError>(
      { error: `No ${module} asset on this package.`, code: "not_found" },
      { status: 404 },
    );
  }

  const content = asset.content as ImageContent | null;
  const variant = content?.variants?.[idxR.data];
  if (!variant) {
    return NextResponse.json<ApiError>(
      { error: "Variant index out of range.", code: "not_found" },
      { status: 404 },
    );
  }
  if (!variant.storagePath) {
    // Should not happen after Stage 1 backfill; defensive 404 so the user
    // can re-trigger generation rather than seeing a 500.
    return NextResponse.json<ApiError>(
      { error: "Variant has no storage path.", code: "not_found" },
      { status: 404 },
    );
  }

  const bucket = MODULE_BUCKETS[module as ImageModuleKey];
  const slug = sanitizeForFilename(details.creator.communityName);
  const filename = `${slug}-${module}-${idxR.data + 1}.png`;

  const signedUrl = await createSignedStorageUrl(
    bucket,
    variant.storagePath,
    DOWNLOAD_REDIRECT_TTL_SECONDS,
    { download: filename },
  );

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
