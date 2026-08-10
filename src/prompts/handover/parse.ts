/**
 * Output parser for generated handover deliverables.
 *
 * Unlike the module generators (structured JSON in XML tags), handover docs
 * are free-form markdown — so this parser is sanity gates, not a Zod parse:
 * strip an accidental wrapping code fence, require a title heading and a
 * minimum length, reject a truncated placeholder token. Word/placeholder
 * counters ported from cli/build_review_html.py.
 *
 * Pure module. 100% branch coverage mandated (generator output parser).
 */

export class HandoverParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandoverParseError";
  }
}

/** Ported: len(re.findall(r"\S+", text)) */
export function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

/** Ported: len(re.findall(r"\[\[[^\[\]]+\]\]", text)) */
export function countPlaceholders(text: string): number {
  return (text.match(/\[\[[^[\]]+\]\]/g) ?? []).length;
}

/**
 * Minimum words for a generated deliverable. Every real doc (emails, VSL,
 * scripts) runs 900+ words; a sub-200-word response means the model bailed
 * or answered conversationally instead of writing the asset.
 */
export const HANDOVER_DOC_MIN_WORDS = 200;

export type ParsedHandoverDoc = {
  contentMd: string;
  wordCount: number;
  placeholderCount: number;
};

export function parseHandoverDoc(raw: string): ParsedHandoverDoc {
  let text = raw.trim();

  // The system prompt bans whole-file code fences, but strip a single
  // wrapping pair defensively rather than failing the run over formatting.
  const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  if (fenced) {
    text = fenced[1].trim();
  }

  if (text.length === 0) {
    throw new HandoverParseError("empty response");
  }
  if (!text.startsWith("# ")) {
    throw new HandoverParseError(
      "response does not start with a '# ' title heading",
    );
  }

  const wordCount = countWords(text);
  if (wordCount < HANDOVER_DOC_MIN_WORDS) {
    throw new HandoverParseError(
      `response too short: ${wordCount} words (min ${HANDOVER_DOC_MIN_WORDS})`,
    );
  }

  // An opening `[[` with no `]]` after it means the output was truncated
  // mid-placeholder — regenerate rather than ship a broken token.
  const lastOpen = text.lastIndexOf("[[");
  if (lastOpen !== -1 && text.indexOf("]]", lastOpen) === -1) {
    throw new HandoverParseError("unclosed [[ placeholder token (truncated output?)");
  }

  return {
    contentMd: text,
    wordCount,
    placeholderCount: countPlaceholders(text),
  };
}
