import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handoverDocuments } from "@/lib/db/schema";
import {
  HANDOVER_DOC_FILENAMES,
  HANDOVER_DOC_LABELS,
} from "@/prompts/handover/deliverables";
import type { ApiError } from "@/lib/validation";

/**
 * GET /api/packages/[id]/handover/documents/[docKey]/md
 *
 * Streams the latest generated markdown for the doc as an attachment —
 * mirror of the package markdown export route, sourced from the DB row.
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
    .select({ contentMd: handoverDocuments.contentMd })
    .from(handoverDocuments)
    .where(
      and(
        eq(handoverDocuments.packageId, idResult.data),
        eq(handoverDocuments.docKey, key),
      ),
    )
    .orderBy(
      desc(handoverDocuments.version),
      desc(handoverDocuments.createdAt),
    )
    .limit(1);
  if (!doc) {
    return NextResponse.json<ApiError>(
      { error: "Document not generated yet.", code: "not_found" },
      { status: 404 },
    );
  }

  const filename = HANDOVER_DOC_FILENAMES[key];
  return new NextResponse(doc.contentMd, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
