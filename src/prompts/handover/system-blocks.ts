/**
 * Shared system prompt for every handover deliverable call in a run.
 *
 * Port of cli/prompts.py build_system_blocks: role, the full voice &
 * guardrails reference, the full deliverable-set structure, the formatted
 * brief, and the raw DNA markdown — with a cache_control breakpoint on the
 * last block. Everything here is byte-identical across the 5 calls of one
 * run, which is what makes Anthropic prompt caching work: the orchestrator
 * fires deliverable 01 alone to write the cache, then the rest read it.
 *
 * Pure module. The block type mirrors the Anthropic SDK's TextBlockParam
 * structurally so Phase C can pass these straight through.
 */
import { type HandoverBrief, formatBrief } from "./brief";

export type HandoverSystemBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

/**
 * Standard placeholder tokens — every generator uses this exact set so the
 * README scan collapses cleanly. Mirrors assets/voice-and-guardrails.md §2.
 */
export const PLACEHOLDER_TOKENS = `- \`[[CREATOR STORY: what belongs here]]\` — the creator's real turning-point / origin
- \`[[REAL NUMBER: description]]\` — years in the space, people served, etc.
- \`[[PROOF: real result — no fabrication]]\` / \`[[TESTIMONIAL: real member quote]]\`
- \`[[EVENT DATE]]\` · \`[[EVENT TITLE]]\` · \`[[EPISODE 1 LINK]]\` · \`[[EPISODE 2 LINK]]\`
- \`[[SKOOL COMMUNITY LINK]]\` (free community, pre-launch) · \`[[SKOOL JOIN LINK]]\` (doors open) · \`[[SKOOL CHANGE-PLAN LINK]]\` (upgrade)
- \`[[FOUNDER RATE ENDS: date/time]]\` · \`[[PRICE INCREASE DATE]]\`
- \`[[GUEST NAME]]\` · \`[[GUEST INTERVIEW DATE]]\` · \`[[HOST CHANNEL]]\`
- \`[[N]]\` (card-retry days) · \`[[REAL CALL MOMENT: real thing that happened on a call]]\``;

export const GUARDRAILS_RECAP = `GUARDRAILS (hard — override anything that conflicts):
- NEVER fabricate stats, testimonials, biography, results, dates, or links. Where a creator-only
  input belongs, emit one of these EXACT placeholder tokens (nothing else):
${PLACEHOLDER_TOKENS}
- Health/fitness: keep peptides / GLP-1s / supplements HIGH-LEVEL — no doses, sources, or protocols;
  route specifics to "a qualified doctor + your bloodwork." No health or weight guarantees. Frame
  around "feeling like yourself," never vanity or shame.
- Money/business: no income guarantees or "you'll make $X" claims — aspirational + [[PROOF]] only.
- Respect the DNA's real refund/trial terms exactly. Founding-member window = the real urgency
  engine (first 72h→1 month, grandfathered); state it once per asset, honestly. No fake counts.
- Match the DNA's own voice. Avoid AI-slop: no "dive in", "unlock", "elevate", "supercharge",
  "game-changer", "it's not just X, it's Y".
- If you add a "how to use this" note explaining the placeholder convention, describe it in
  PLAIN WORDS ("double-bracket tokens", "fill-in-the-blank items") — never write ANY bracketed
  example of the pattern itself (not \`[[...]]\`, not \`[[…]]\`, not \`[[xyz]]\`, not \`[[brackets]]\`,
  no variant at all) — every \`[[...]]\`-shaped string in the file gets scanned as a real
  placeholder, so demonstrating the syntax creates a fake one.`;

export function buildHandoverSystemBlocks(params: {
  brief: HandoverBrief;
  dnaMarkdown: string;
  guardrailsText: string;
  structureText: string;
}): HandoverSystemBlock[] {
  return [
    {
      type: "text",
      text:
        "You are an expert direct-response copywriter producing ONE asset of a Skool " +
        "community launch handover for a done-for-you agency. Return ONLY the finished " +
        "Markdown for the asset you're asked for — no preamble, no explanation, no ``` " +
        "code fences around the whole thing.",
    },
    {
      type: "text",
      text: "FULL VOICE & GUARDRAILS REFERENCE:\n\n" + params.guardrailsText,
    },
    {
      type: "text",
      text:
        "THE FULL DELIVERABLE SET this asset is one piece of (for consistency — " +
        "reference other assets by name/number where natural, e.g. pointing to the " +
        "docuseries or the DM flows):\n\n" + params.structureText,
    },
    { type: "text", text: formatBrief(params.brief) },
    {
      type: "text",
      text:
        "THIS COMMUNITY'S PRE-SKOOL DNA (the source of truth for every fact):\n\n" +
        params.dnaMarkdown,
      // Last block = the cache breakpoint. Everything above is identical on
      // every call this run, so this is where the cached prefix ends.
      cache_control: { type: "ephemeral" },
    },
  ];
}
