/**
 * Placeholder scan across a run's generated deliverables — feeds the README
 * checklist. Port of scaffold_handover.py scan_placeholders: collect every
 * `[[...]]` token, normalize on the label before the first ':' so variants
 * collapse ("CREATOR STORY: x" and "CREATOR STORY: y" → "CREATOR STORY"),
 * dedupe, sort.
 *
 * The readme doc is excluded by contract (callers pass generated docs only,
 * but the guard stays — the README's own boilerplate describes the token
 * convention and must never scan as a real fill-in).
 *
 * Pure module. 100% branch coverage mandated (generator output parser).
 */
import type { HandoverDocKey } from "./deliverables";

export function scanPlaceholders(
  docs: { docKey: HandoverDocKey; contentMd: string }[],
): string[] {
  const labels = new Set<string>();
  for (const doc of docs) {
    if (doc.docKey === "readme") continue;
    for (const match of doc.contentMd.matchAll(/\[\[(.+?)\]\]/g)) {
      const label = match[1].split(":")[0].trim();
      if (label.length > 0) labels.add(label);
    }
  }
  return [...labels].sort();
}
