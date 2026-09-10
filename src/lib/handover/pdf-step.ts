import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { handoverDocuments, type HandoverDocument } from "@/lib/db/schema";
import {
  HANDOVER_DOC_FILENAMES,
  HANDOVER_DOC_LABELS,
  type HandoverDocKey,
} from "@/prompts/handover/deliverables";
import { renderHandoverDocHtml } from "./pdf-html";
import { renderPdfs } from "./pdf";
import { uploadStorageObject } from "@/lib/storage/upload";

export const HANDOVER_DOCS_BUCKET = "handover-docs";

/** "01-vsl-and-cancellation.md" → "01". */
function docNum(docKey: HandoverDocKey): string {
  return HANDOVER_DOC_FILENAMES[docKey].slice(0, 2);
}

/**
 * The full PDF render step for one run: build each doc's standalone HTML,
 * render all of them in one Chromium launch, upload to the private
 * handover-docs bucket, and stamp `pdfPath` on each row. Idempotent —
 * uploads upsert and paths are deterministic, so an Inngest step retry
 * overwrites rather than duplicates.
 */
export async function renderHandoverDocPdfs(params: {
  packageId: string;
  runId: string;
  docs: HandoverDocument[];
}): Promise<{ rendered: number }> {
  const { packageId, runId, docs } = params;

  // The README's title line is "# <Community> — Launch Handover"; the spec
  // strip on every page brands with the community name (port of
  // export_pdfs.py's parse of the README header).
  const readme = docs.find((d) => d.docKey === "readme");
  const community =
    readme?.contentMd
      .split("\n")[0]
      ?.replace(/^#\s+/, "")
      .split("—")[0]
      .trim() ?? "Launch Handover";

  const ordered = [...docs].sort((a, b) =>
    HANDOVER_DOC_FILENAMES[a.docKey].localeCompare(
      HANDOVER_DOC_FILENAMES[b.docKey],
    ),
  );

  const inputs = ordered.map((doc) => ({
    filename: HANDOVER_DOC_FILENAMES[doc.docKey].replace(/\.md$/, ".pdf"),
    html: renderHandoverDocHtml({
      community,
      num: docNum(doc.docKey),
      title:
        doc.docKey === "readme" ? "Overview" : HANDOVER_DOC_LABELS[doc.docKey],
      contentMd: doc.contentMd,
    }),
  }));

  const pdfs = await renderPdfs(inputs);

  for (const doc of ordered) {
    const filename = HANDOVER_DOC_FILENAMES[doc.docKey].replace(
      /\.md$/,
      ".pdf",
    );
    const buffer = pdfs.get(filename);
    if (!buffer) continue;
    const path = `${packageId}/${runId}/${filename}`;
    await uploadStorageObject(
      HANDOVER_DOCS_BUCKET,
      path,
      buffer,
      "application/pdf",
    );
    await db
      .update(handoverDocuments)
      .set({ pdfPath: path })
      .where(eq(handoverDocuments.id, doc.id));
  }

  return { rendered: pdfs.size };
}
