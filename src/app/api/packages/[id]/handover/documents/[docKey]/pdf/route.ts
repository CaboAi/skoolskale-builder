import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handoverDocuments } from "@/lib/db/schema";
import {
  createSignedStorageUrl,
  DOWNLOAD_REDIRECT_TTL_SECONDS,
} from "@/lib/storage/signed-url";
import { HANDOVER_DOCS_BUCKET } from "@/lib/handover/pdf-step";
import {
  HANDOVER_DOC_FILENAMES,
  HANDOVER_DOC_LABELS,
} from "@/prompts/handover/deliverables";
import type { ApiError } from "@/lib/validation";

/**
 * GET /api/packages/[id]/handover/documents/[docKey]/pdf
 *
 * Signs the latest rendered PDF for the doc and 302s to it. The signed URL
 * carries `?download=<filename>` so the cross-origin storage host serves
 * Content-Disposition: attachment (same pattern the signed-URLs migration
 * established for image downloads).
 */

const UuidParam = z.string().uuid();
const DocKeyParam = z.enum(
  Object.keys(HANDOVER_DOC_LABELS) as [string, ...string[]],
);

type RouteCtx = { params: Promise<{ id: string; docKey: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  await requireUser();
  const { id, docKey } = await params;

  const idResult = UuidParam.safeParse(id);
  const keyResult = DocKeyParam.safeParse(docKey);
  if (!idResult.success || !keyResult.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid package id or doc key.", code: "invalid_id" },
      { status: 400 },
    );
  }
  const key = keyResult.data as keyof typeof HANDOVER_DOC_FILENAMES;

  const [doc] = await db
    .select({ pdfPath: handoverDocuments.pdfPath })
    .from(handoverDocuments)
    .where(
      and(
        eq(handoverDocuments.packageId, idResult.data),
        eq(handoverDocuments.docKey, key),
        isNotNull(handoverDocuments.pdfPath),
      ),
    )
    .orderBy(
      desc(handoverDocuments.version),
      desc(handoverDocuments.createdAt),
    )
    .limit(1);
  if (!doc?.pdfPath) {
    return NextResponse.json<ApiError>(
      { error: "No rendered PDF for this document yet.", code: "not_found" },
      { status: 404 },
    );
  }

  const filename = HANDOVER_DOC_FILENAMES[key].replace(/\.md$/, ".pdf");
  const signedUrl = await createSignedStorageUrl(
    HANDOVER_DOCS_BUCKET,
    doc.pdfPath,
    DOWNLOAD_REDIRECT_TTL_SECONDS,
    { download: filename },
  );
  return NextResponse.redirect(signedUrl, 302);
}
