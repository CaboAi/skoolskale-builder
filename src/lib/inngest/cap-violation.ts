/**
 * Typed error thrown by per-module parsers when a generated output
 * exceeds the module's Skool character cap.
 *
 * Lives in a tiny standalone module (no DB, no Inngest, no `server-only`)
 * so it can be imported by both prompts (`@/prompts/*`) and the generator
 * factory without dragging server-side deps into the client bundle.
 *
 * The factory in `_shared.ts` catches this specific class once per run
 * to fire its single "rewrite tighter" retry; if the retry also throws
 * a CapViolationError, the error propagates and the job lands in
 * `failed` with the actual length in the message.
 */

// `@/prompts/_shared` is itself dependency-free (one pure string helper),
// so importing it here keeps this module client-safe and cycle-free.
import { regenerateNoteSuffix } from '@/prompts/_shared';

export type CapViolationDetail = {
  /** Module key, e.g. 'welcome_dm'. */
  module: string;
  /** Human-readable module label for error messages, e.g. 'About Us'. */
  moduleLabel: string;
  /** Character length of the rendered output that exceeded the cap. */
  actualChars: number;
  /** The configured hard cap. */
  maxChars: number;
  /**
   * Raw Claude response. The factory passes this back to Claude in the
   * retry's user message so the model can see what it produced.
   */
  rawOutput: string;
};

export class CapViolationError extends Error {
  readonly module: string;
  readonly moduleLabel: string;
  readonly actualChars: number;
  readonly maxChars: number;
  readonly rawOutput: string;

  constructor(detail: CapViolationDetail) {
    super(
      `${detail.moduleLabel} is ${detail.actualChars} chars (cap: ${detail.maxChars})`,
    );
    this.name = 'CapViolationError';
    this.module = detail.module;
    this.moduleLabel = detail.moduleLabel;
    this.actualChars = detail.actualChars;
    this.maxChars = detail.maxChars;
    this.rawOutput = detail.rawOutput;
  }
}

/**
 * Build the user-message suffix appended on the single auto-retry.
 * Concrete numbers + "same structure" gives the model the targeted
 * signal it needs to cut without restructuring.
 *
 * When a `regenerateNote` is present (e.g. the VA asked to "make it
 * longer"), the directive softens to "trim only enough to fit, stay
 * near the cap" instead of "cut whichever bucket is least essential",
 * and the note is re-stated AFTER the trim directive so it remains the
 * last — and most heavily weighted — signal. Without a note the output
 * is byte-identical to the original blunt-trim instruction, preserving
 * behavior for every note-less regeneration and other modules.
 */
export function buildCapRetryInstruction(detail: {
  actualChars: number;
  maxChars: number;
  rawOutput: string;
  regenerateNote?: string;
}): string {
  const hasNote = Boolean(detail.regenerateNote?.trim());
  // No-note directive is intentionally byte-identical to the pre-fix
  // wording — regression-guarded by the no-note test.
  //
  // With-note directive uses module-agnostic vocabulary ("removing
  // sections" instead of "dropping a bucket") because this helper is
  // shared by every module that throws CapViolationError (about_us,
  // welcome_dm, first-post), and appends a cap-vs-note disambiguation
  // clause so the priority-framed note suffix below ("user feedback
  // wins") can't be misread as overriding the cap on length-up notes
  // like "much longer".
  const directive = hasNote
    ? `That was ${detail.actualChars} characters. Cap is ${detail.maxChars}. Trim only enough to land just under ${detail.maxChars} — stay as close to the cap as possible. Keep the same structure; tighten existing sentences rather than removing sections. The note below is honored within the ${detail.maxChars}-char cap; the cap is the hard ceiling.`
    : `That was ${detail.actualChars} characters. Cap is ${detail.maxChars}. Rewrite tighter — cut whichever bucket or sentence is least essential. Keep the same structure.`;
  return `

<previous_attempt chars="${detail.actualChars}">
${detail.rawOutput.trim()}
</previous_attempt>

<retry_instruction>
${directive}
</retry_instruction>${regenerateNoteSuffix(detail.regenerateNote)}`;
}

/**
 * Thrown by a prompt builder when the creator has no Step 5 intake for a
 * module that requires it (currently: classroom, calendar). The runner
 * in `_shared.ts` catches this BEFORE calling Claude, writes an empty
 * generated_asset row, and marks the job done. The dashboard renders
 * the module card with an empty list rather than a 'failed' badge.
 *
 * Modules that synthesize from the creator profile alone (leaderboard,
 * categories, discovery_seo) never throw this — they have sensible
 * defaults regardless of Step 5 intake.
 */
export class EmptyIntakeError extends Error {
  readonly module: string;
  readonly moduleLabel: string;
  /** The shape to persist as the empty asset's `content`. */
  readonly emptyContent: object;

  constructor(detail: {
    module: string;
    moduleLabel: string;
    emptyContent: object;
  }) {
    super(`${detail.moduleLabel}: no intake supplied — skipping`);
    this.name = "EmptyIntakeError";
    this.module = detail.module;
    this.moduleLabel = detail.moduleLabel;
    this.emptyContent = detail.emptyContent;
  }
}
