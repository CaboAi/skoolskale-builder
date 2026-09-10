/**
 * Render one handover deliverable markdown file to a standalone HTML page
 * using the pipeline's own renderer, so a locally produced review copy is
 * styled identically to what the deployed PDF step emits.
 *
 * Usage:
 *   pnpm tsx scripts/render-doc-html.ts <in.md> <out.html> <community> <num> <title>
 *
 * Print to PDF with headless Chrome (Edge's bundled renderer drops the
 * webfont fallbacks this CSS relies on):
 *   chrome --headless --disable-gpu --print-to-pdf=<out.pdf> \
 *          --no-pdf-header-footer <out.html>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { renderHandoverDocHtml } from "../src/lib/handover/pdf-html";

const [inPath, outPath, community, num, title] = process.argv.slice(2);
if (!inPath || !outPath || !community || !num || !title) {
  console.error(
    "usage: render-doc-html.ts <in.md> <out.html> <community> <num> <title>",
  );
  process.exit(1);
}

const contentMd = readFileSync(inPath, "utf8");
writeFileSync(
  outPath,
  renderHandoverDocHtml({ community, num, title, contentMd }),
  "utf8",
);
console.log(`wrote ${outPath}`);
