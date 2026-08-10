import { describe, expect, test } from "vitest";
import { buildHandoverReadme } from "@/prompts/handover/readme";
import { FULL_BRIEF, MINIMAL_BRIEF } from "./fixtures";

const GENERATED_DATE = "2026-08-10";

const EXPECTED_FULL = `# Soul Collective — Launch Handover
_Jane Doe · spiritual · warm · generated 2026-08-10 (SkoolSkale builder)_

**Transformation:** From burned out to grounded
**Audience:** women 30-55
**Offer:** Free · Standard ($27/mo or $227/yr) · VIP ($57/mo or $477/yr)
**Guest sessions:** Yes · **Trial:** No trial · **Refund:** 14-day refund
**Support:** support@example.test

## Deliverables
| # | File | What it is |
|---|------|------------|
| 00 | (this file) | Index + placeholder checklist |
| 01 | [vsl-and-cancellation](01-vsl-and-cancellation.md) | VSL + Cancellation |
| 02 | [pre-launch-emails](02-pre-launch-emails.md) | Pre-Launch Emails |
| 03 | [post-launch-emails](03-post-launch-emails.md) | Post-Launch Emails |
| 04 | [docuseries-full-script](04-docuseries-full-script.md) | Docuseries — Full Script |
| 05 | [dm-sequences](05-dm-sequences.md) | DM Sequences |

## ⚠️ Fill these before use
Nothing here was fabricated. Every double-bracket item below is an input only the creator can
supply — search the files for the exact token and replace it.

- [ ] \`[[CREATOR STORY]]\`
- [ ] \`[[EVENT DATE]]\`

## Notes
- Tier names/prices come straight from the Pre-Skool DNA. Adjust the module→tier split to match
  how the community actually gates content in Skool.
- Health/finance kept high-level (no doses/protocols/guarantees); founding-member window is the
  urgency engine — set one consistent \`[[FOUNDER RATE ENDS]]\` date across the VSL, emails, and docuseries.
`;

describe("buildHandoverReadme", () => {
  test("full brief + labels + fixed date renders the exact README", () => {
    const out = buildHandoverReadme(
      FULL_BRIEF,
      ["CREATOR STORY", "EVENT DATE"],
      GENERATED_DATE,
    );
    expect(out).toBe(EXPECTED_FULL);
  });

  test("empty labels render the nothing-to-fill placeholder row", () => {
    const out = buildHandoverReadme(MINIMAL_BRIEF, [], GENERATED_DATE);
    expect(out).toContain("- _(none — nothing to fill)_");
    expect(out).not.toContain("- [ ]");
  });

  test("null transformationLine falls back to the intake transformation", () => {
    const out = buildHandoverReadme(MINIMAL_BRIEF, [], GENERATED_DATE);
    expect(out).toContain(
      "**Transformation:** get strong without burning out",
    );
  });

  test("null refund and support render as not specified", () => {
    const out = buildHandoverReadme(MINIMAL_BRIEF, [], GENERATED_DATE);
    expect(out).toContain(
      "**Guest sessions:** No · **Trial:** 7-day trial · **Refund:** not specified",
    );
    expect(out).toContain("**Support:** not specified");
  });

  test("offer line reflects a monthly-only tier without annual", () => {
    const out = buildHandoverReadme(MINIMAL_BRIEF, [], GENERATED_DATE);
    expect(out).toContain("**Offer:** Free · Standard ($27/mo)");
  });
});
