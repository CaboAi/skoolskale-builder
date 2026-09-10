/**
 * Shared prompt-builder helpers.
 */

/**
 * If the VA supplied a regenerate note, return a priority-framed suffix
 * to append to the END of the user message (text modules) or natural-
 * language prompt (image modules). Models weight later tokens more
 * heavily, so the suffix carries more influence than a mid-prompt block.
 *
 * Returns "" when the note is missing/blank/whitespace-only, so callers
 * can do unconditional `prompt + regenerateNoteSuffix(note)` without
 * branching and without changing output for the no-note path.
 */
export function regenerateNoteSuffix(note?: string | null): string {
  const trimmed = note?.trim();
  if (!trimmed) return "";
  return `\n\nUSER FEEDBACK TO INCORPORATE:\n${trimmed}\n\nTreat this feedback as priority guidance. If it conflicts with default style choices, the user feedback wins.`;
}
