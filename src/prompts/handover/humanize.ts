/**
 * Humanizer pass — a second Claude call that rewrites a finished deliverable
 * to strip AI writing tells, without changing what it says.
 *
 * Why a separate pass instead of another system block on the generation
 * call: the generation prompt already carries a framework, a gold example,
 * a guardrails reference and a brief, and a style instruction sitting among
 * them loses to the structural ones. The guardrails have carried an
 * "avoid AI-slop" line for a while and the output still read as AI prose.
 *
 * The rewrite is destructive by design, so this module also owns the
 * preservation contract: the machinery downstream depends on markers a
 * naive rewrite would happily "improve" away.
 *
 *   - parse.ts requires the doc to still open with a `# ` title heading.
 *   - scan-placeholders.ts builds the client's fill-in checklist from every
 *     `[[TOKEN]]`; a dropped or reworded token silently shortens that list.
 *   - Merge tags and CTA rows are literal strings the platforms match on,
 *     not prose.
 *
 * Upstream rule 20 (sentence-case headings, strip decoration) and rule 19
 * (drop bold labels) are exactly the rules that would break the first two,
 * so the contract below is stated as an override that outranks the skill.
 *
 * Pure module — no fs, no DB, no `server-only`. The caller loads the asset.
 */
import type { HandoverSystemBlock } from "./system-blocks";
import { countWords, HANDOVER_DOC_MIN_WORDS } from "./parse";

/**
 * Every `[[...]]` token in the text, normalized the way the README scan
 * normalizes them: the label before the first ':'. Two docs with the same
 * label set carry the same client checklist, which is the property the
 * rewrite must not change.
 */
export function placeholderLabels(text: string): Set<string> {
  const labels = new Set<string>();
  for (const match of text.matchAll(/\[\[(.+?)\]\]/g)) {
    const label = match[1].split(":")[0].trim();
    if (label.length > 0) labels.add(label);
  }
  return labels;
}

export type HumanizeCheck =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Gate the rewrite before it replaces a good document. A failure here is
 * never fatal: the caller keeps the original and logs the reason, because
 * a slightly AI-sounding deliverable beats losing a 15-minute Opus
 * generation to an over-eager editor.
 */
export function checkHumanizedDoc(
  original: string,
  humanized: string,
): HumanizeCheck {
  const text = humanized.trim();
  if (text.length === 0) return { ok: false, reason: "empty rewrite" };
  if (!text.startsWith("# ")) {
    return { ok: false, reason: "rewrite lost its '# ' title heading" };
  }

  const before = placeholderLabels(original);
  const after = placeholderLabels(humanized);
  const dropped = [...before].filter((label) => !after.has(label));
  if (dropped.length > 0) {
    return {
      ok: false,
      reason: `rewrite dropped placeholder(s): ${dropped.sort().join(", ")}`,
    };
  }
  const invented = [...after].filter((label) => !before.has(label));
  if (invented.length > 0) {
    return {
      ok: false,
      reason: `rewrite invented placeholder(s): ${invented.sort().join(", ")}`,
    };
  }

  const words = countWords(text);
  if (words < HANDOVER_DOC_MIN_WORDS) {
    return { ok: false, reason: `rewrite too short: ${words} words` };
  }

  /**
   * The skill legitimately shortens padded prose, so some loss is the point.
   * Half the original is well past editing into rewriting-from-scratch, and
   * in practice means the model summarized instead of editing.
   */
  const originalWords = countWords(original);
  if (originalWords > 0 && words < originalWords * 0.5) {
    return {
      ok: false,
      reason: `rewrite cut too much: ${words} of ${originalWords} words`,
    };
  }

  return { ok: true };
}

/** Overrides the skill's own formatting rules where our pipeline depends on them. */
const PRESERVATION_CONTRACT = `PRESERVATION CONTRACT (outranks every rule in the skill above):

1. Keep the document's heading STRUCTURE exactly: the same headings, at the same
   levels, in the same order, with the same wording. The file must still open with
   its \`# \` title line. Ignore the skill's guidance on sentence-case headings and
   decorative headings — downstream tooling parses these and a "better" heading
   breaks it. You are editing the prose UNDER the headings.
2. Reproduce every double-bracket token EXACTLY as written, character for
   character, including its inner text. Do not reword one, do not translate one,
   do not merge two, do not add a new one, do not drop one. They are fill-in slots
   for the creator and a checklist is generated from them.
3. Leave merge tags and platform tokens byte-identical: {{firstName}}, #NAME#,
   #GROUPNAME#, and anything else in that shape.
4. Leave CTA button rows as they are, including their brackets and labels.
5. Keep every concrete fact: prices, tier names, module names, call names and
   times, dates, policy terms, the founding-rate mechanic. Invent nothing. If a
   sentence reads as padding, cut it rather than replacing it with a fact you do
   not have.
6. Keep the first-person voice and the speaking rhythm. These are teleprompter
   and email scripts meant to be read aloud by the creator, not reference prose.
   Contractions, short lines and direct address are correct here.

Everything else in the skill applies in full, and the em-dash rule applies to the
prose: replace dashes with a period, comma, colon or parentheses.`;

export function buildHumanizeSystemBlocks(params: {
  humanizerSkill: string;
  dnaMarkdown: string;
}): HandoverSystemBlock[] {
  return [
    {
      type: "text",
      text:
        "You are a line editor. You are given one finished marketing asset that " +
        "was drafted by an AI, and you rewrite it so it reads like the creator " +
        "wrote it. You change how it sounds, never what it says. Return ONLY the " +
        "rewritten Markdown, with no preamble, no commentary, no explanation of " +
        "your edits, and no ``` code fences around the whole thing.",
    },
    { type: "text", text: params.humanizerSkill },
    { type: "text", text: PRESERVATION_CONTRACT },
    {
      type: "text",
      /**
       * The DNA is the voice sample the skill asks for. It is the creator's
       * own words about their community, so matching it is closer to the
       * target than the skill's generic "take the voice from the kind of
       * text" fallback.
       */
      text:
        "VOICE SAMPLE — this community's Pre-Skool DNA, written in and about the " +
        "creator's own voice. Match its sentence length, word choice and rhythm. " +
        "Per the skill, this sample overrides the skill's default style guidance, " +
        "EXCEPT that the em-dash rule still applies:\n\n" +
        params.dnaMarkdown,
      cache_control: { type: "ephemeral" },
    },
  ];
}

export function buildHumanizeUserPrompt(params: {
  docTitle: string;
  contentMd: string;
}): string {
  return `Rewrite this asset — "${params.docTitle}" — removing the AI writing
patterns described above while obeying the preservation contract.

Work the whole document. Pay closest attention to the tells the skill ranks
strongest: not-X-but-Y contrasts, one-line closers that restate the paragraph
before them, sayings that sound deep, staged run-ups, and arguing with no one.
These scripts are especially prone to the one-line dramatic closer.

Return the finished Markdown only.

---

${params.contentMd}`;
}
