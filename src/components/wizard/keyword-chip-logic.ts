/**
 * Pure helpers for KeywordChipField. Kept separate from the React component
 * so the keyword-management rules (de-dupe, max enforcement, trim) can be
 * unit-tested without a DOM.
 */

export type ChipCommitResult = {
  values: string[];
  /** Whether the draft was actually consumed (false on dedup/blank/at-max). */
  committed: boolean;
};

export function commitChip(
  current: string[],
  draft: string,
  max: number,
): ChipCommitResult {
  const trimmed = draft.trim();
  if (!trimmed) return { values: current, committed: false };
  if (current.includes(trimmed)) return { values: current, committed: false };
  if (current.length >= max) return { values: current, committed: false };
  return { values: [...current, trimmed], committed: true };
}

export function removeChipAt(current: string[], index: number): string[] {
  if (index < 0 || index >= current.length) return current;
  const next = [...current];
  next.splice(index, 1);
  return next;
}
