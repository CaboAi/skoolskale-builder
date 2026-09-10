/**
 * Renderers — JSON module outputs → the exact text VAs paste into Skool.
 *
 * These functions are the single source of truth for "rendered length"
 * — the thing Skool's character caps apply to. The Zod schemas use them
 * in .refine() to reject over-cap outputs at parse time, and ExportView
 * uses them to populate the copy buttons VAs actually click. If a
 * renderer changes, the cap math implicitly changes too.
 *
 * Pure module. No `server-only`, no DB, no runtime deps — bundled into
 * the client because the edit form's live char counter calls it on every
 * keystroke.
 */

export type AboutUsRenderable = {
  hero: string;
  trial_callout: string;
  value_buckets: { emoji: string; header: string; items: string[] }[];
  pricing: string;
  refund_policy: string;
};

/**
 * Render About Us JSON to the exact paste-ready text used in Skool >
 * Settings > About. Buckets render as `{emoji} {header}\n{line}` when
 * exactly one item is present (the new structure after the Skool-cap
 * fix), and fall back to a `- ` bulleted list when legacy multi-item
 * data is present so older assets still render correctly.
 */
export function renderAboutUsText(c: AboutUsRenderable): string {
  const buckets = c.value_buckets
    .map((b) => {
      const body =
        b.items.length === 1
          ? b.items[0]
          : b.items.map((i) => `- ${i}`).join("\n");
      return `${b.emoji} ${b.header}\n${body}`;
    })
    .join("\n\n");
  return [
    c.hero,
    "",
    c.trial_callout,
    "",
    buckets,
    "",
    c.pricing,
    "",
    c.refund_policy,
  ]
    .join("\n")
    .trim();
}
