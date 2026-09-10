import "server-only";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Chromium PDF renderer for handover documents.
 *
 * `@sparticuz/chromium` ships a Lambda-compatible Linux Chromium that
 * puppeteer-core drives on Vercel. Local dev on Windows/macOS sets
 * `PUPPETEER_EXECUTABLE_PATH` to an installed Chrome/Edge instead — the
 * sparticuz binary is Linux-only.
 *
 * Both packages are imported dynamically inside the function so they're
 * only loaded by the Inngest render step, never by route-handler bundles.
 */

export type PdfRenderInput = {
  /** Storage-side filename, e.g. "01-vsl-and-cancellation.pdf". */
  filename: string;
  html: string;
};

export async function renderPdfs(
  inputs: PdfRenderInput[],
): Promise<Map<string, Buffer>> {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);

  // Local dev: point PUPPETEER_EXECUTABLE_PATH at installed CHROME — Edge
  // exits silently (code 0, no error) under puppeteer on this project's dev
  // machine, the same failure the DFY export scripts documented. The temp
  // profile + flags mirror the config the smoke test validated.
  const localExecutable = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch(
    localExecutable
      ? {
          executablePath: localExecutable,
          userDataDir: mkdtempSync(path.join(tmpdir(), "handover-pdf-")),
          args: ["--no-first-run", "--disable-gpu", "--no-sandbox"],
        }
      : {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
        },
  );

  try {
    const out = new Map<string, Buffer>();
    // Sequential on one browser: 6 docs render in seconds each, and a
    // single Chromium keeps peak memory predictable inside the function.
    for (const input of inputs) {
      const page = await browser.newPage();
      try {
        await page.setContent(input.html, { waitUntil: "domcontentloaded" });
        const pdf = await page.pdf({ format: "letter", printBackground: true });
        out.set(input.filename, Buffer.from(pdf));
      } finally {
        await page.close();
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}
