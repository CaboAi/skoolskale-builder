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
 */
export function buildCapRetryInstruction(detail: {
  actualChars: number;
  maxChars: number;
  rawOutput: string;
}): string {
  return `

<previous_attempt chars="${detail.actualChars}">
${detail.rawOutput.trim()}
</previous_attempt>

<retry_instruction>
That was ${detail.actualChars} characters. Cap is ${detail.maxChars}. Rewrite tighter — cut whichever bucket or sentence is least essential. Keep the same structure.
</retry_instruction>`;
}
