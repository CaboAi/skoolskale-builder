/**
 * Community icon image prompt builder (PRD I2).
 *
 * Produces 3 text-forward logo concepts for a Skool community icon
 * (512x512). Variants differ by stylistic suffix injected per-call so
 * the model returns visually distinct options. No reference image —
 * icons are wordmark/symbol concepts, not photographs.
 *
 * Output schema mirrors cover: an array of variants in
 * generated_assets.content. Same selected_variant_index field.
 */
import { z } from "zod";
import type { CreatorContext } from "@/types/generators";

export const IconContentSchema = z.object({
  variants: z.array(
    z.object({
      url: z.string().url(),
      index: z.number().int().min(0),
    }),
  ),
  selected_variant_index: z.number().int().min(0).optional(),
});

export type IconStyle = "geometric" | "typographic" | "iconic";

const STYLES: Record<IconStyle, string> = {
  geometric:
    "Geometric monogram. Bold, angular shapes. Use the community initials inside or anchored to a strong geometric mark (circle, hexagon, square). Limit to 2 colors plus background. Confident and modern.",
  typographic:
    "Typographic wordmark. The community name set in a bold custom-feeling sans-serif. Letter spacing tight. One accent color. No imagery — type carries the entire identity.",
  iconic:
    "Symbolic icon. A simple, memorable symbol (single-glyph metaphor — a flame, leaf, summit, key, etc.) chosen to evoke the community's transformation. Flat color, no gradients, instantly readable at 64x64.",
};

export const ICON_STYLES: ReadonlyArray<IconStyle> = [
  "geometric",
  "typographic",
  "iconic",
];

function moodForNiche(niche: CreatorContext["niche"]): string {
  switch (niche) {
    case "spiritual":
    case "yoga":
      return "Grounded, contemplative palette — sage, warm earth, soft ivory.";
    case "relationships":
      return "Warm, human palette — terracotta, blush, deep rose.";
    case "business":
    case "money":
      return "Confident, premium palette — deep navy, charcoal, matte gold accent.";
    case "fitness":
      return "Energetic, high-contrast palette — black, electric red or orange accent.";
    default:
      return "Modern, professional palette — one bold accent color, neutral background.";
  }
}

/**
 * Build the prompt for ONE icon variant. The Inngest function calls this
 * once per style in ICON_STYLES so each variant is visually distinct.
 */
export function buildIconPrompt(input: {
  creator: CreatorContext;
  style: IconStyle;
}): string {
  const { creator, style } = input;
  const mood = moodForNiche(creator.niche);

  return [
    `A community icon (square logo) for the Skool community "${creator.community_name}".`,
    `Aspect ratio 1:1 (512x512). Designed to read clearly at small sizes (down to 64x64).`,
    `Style: ${STYLES[style]}`,
    mood,
    `Niche cue: ${creator.niche}. The icon should subtly evoke "${creator.transformation}" without spelling it out.`,
    `Hard constraints: solid centered composition; no photographs of people; no gibberish or garbled text; if any text appears it must read exactly "${creator.community_name}" and be perfectly legible; no watermarks, signatures, or extra logos; flat clean rendering, no drop-shadows or chrome effects.`,
  ].join("\n");
}
