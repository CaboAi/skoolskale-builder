import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HANDOVER_DELIVERABLES } from "./deliverables";

/**
 * Runtime loader for the handover framework references + gold-example
 * templates committed under assets/. Read from disk (not bundled as string
 * consts) so they stay reviewable as plain markdown; `next.config.ts`
 * declares `outputFileTracingIncludes` for `/api/inngest` so Vercel traces
 * them into the deployed function.
 *
 * Cached per process — the files are immutable at runtime.
 */

const ASSETS_DIR = path.join(
  process.cwd(),
  "src",
  "prompts",
  "handover",
  "assets",
);

const cache = new Map<string, string>();

export function loadHandoverAsset(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const text = readFileSync(path.join(ASSETS_DIR, name), "utf8");
  cache.set(name, text);
  return text;
}

/**
 * Fail-fast check that every registered asset file is readable — port of
 * cli/generate.py load_asset_sources(). The orchestrator calls this before
 * spending any tokens, so a Vercel file-tracing misconfiguration surfaces
 * as a clean error instead of a mid-run failure.
 */
export function assertHandoverAssets(): void {
  const names = new Set<string>(["voice-and-guardrails.md", "handover-structure.md"]);
  for (const d of HANDOVER_DELIVERABLES) {
    names.add(d.referenceAsset);
    for (const t of d.templateAssets(true)) names.add(t);
  }
  const missing = [...names].filter((name) => {
    try {
      loadHandoverAsset(name);
      return false;
    } catch {
      return true;
    }
  });
  if (missing.length > 0) {
    throw new Error(
      `missing handover asset files: ${missing.sort().join(", ")}`,
    );
  }
}
