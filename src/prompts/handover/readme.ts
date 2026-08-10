/**
 * 00-README.md builder — deterministic index + placeholder checklist.
 * Port of cli/generate.py build_readme; the generation date is injected so
 * the output stays testable.
 *
 * Pure module.
 */
import { type HandoverBrief, formatTierSummary } from "./brief";
import { HANDOVER_DELIVERABLES, HANDOVER_DOC_FILENAMES } from "./deliverables";

export function buildHandoverReadme(
  brief: HandoverBrief,
  placeholderLabels: string[],
  dateStr: string,
): string {
  const rows = HANDOVER_DELIVERABLES.map((d) => {
    const filename = HANDOVER_DOC_FILENAMES[d.docKey];
    return `| ${d.num} | [${filename.slice(3, -3)}](${filename}) | ${d.title} |`;
  }).join("\n");
  const checklist =
    placeholderLabels.map((lbl) => `- [ ] \`[[${lbl}]]\``).join("\n") ||
    "- _(none — nothing to fill)_";

  return `# ${brief.community} — Launch Handover
_${brief.creator} · ${brief.niche} · ${brief.tone} · generated ${dateStr} (SkoolSkale builder)_

**Transformation:** ${brief.transformationLine ?? brief.transformation}
**Audience:** ${brief.audience}
**Offer:** ${formatTierSummary(brief.pricing)}
**Guest sessions:** ${brief.guestSessions ? "Yes" : "No"} · **Trial:** ${brief.trial} · **Refund:** ${brief.refund ?? "not specified"}
**Support:** ${brief.supportEmail ?? "not specified"}

## Deliverables
| # | File | What it is |
|---|------|------------|
| 00 | (this file) | Index + placeholder checklist |
${rows}

## ⚠️ Fill these before use
Nothing here was fabricated. Every double-bracket item below is an input only the creator can
supply — search the files for the exact token and replace it.

${checklist}

## Notes
- Tier names/prices come straight from the Pre-Skool DNA. Adjust the module→tier split to match
  how the community actually gates content in Skool.
- Health/finance kept high-level (no doses/protocols/guarantees); founding-member window is the
  urgency engine — set one consistent \`[[FOUNDER RATE ENDS]]\` date across the VSL, emails, and docuseries.
`;
}
