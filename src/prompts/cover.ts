/**
 * Cover image prompt builder.
 *
 * The output is a natural-language prompt for Gemini 3.1 Flash Image
 * ("Nano Banana 2") — NOT a Claude text prompt. No Zod schema and no
 * parser: the model returns an image, not structured text.
 *
 * Style descriptors are hardcoded here on purpose — `seeds/patterns.json`
 * does not include cover examples yet, and for the demo we don't need
 * pattern-library lookup for images.
 */
import type { CreatorContext } from "@/types/generators";

export type CoverStyle = "photographic" | "illustrated" | "minimalist";

type StyleDescriptor = {
  label: CoverStyle;
  description: string;
};

const STYLES: Record<CoverStyle, StyleDescriptor> = {
  photographic: {
    label: "photographic",
    description:
      "Photographic style. Modern, bold typography. Sharp focus on the creator, natural lighting, high contrast, vibrant but grounded color palette.",
  },
  illustrated: {
    label: "illustrated",
    description:
      "Illustrated style. Warm tones, organic shapes, hand-drawn accents. Editorial-magazine feel. The creator rendered as a stylized illustration that still reads as them.",
  },
  minimalist: {
    label: "minimalist",
    description:
      "Minimalist style. Generous negative space, limited palette (2-3 colors), clean geometric layout. Typography is the focal point; imagery is subordinate.",
  },
};

/**
 * Niche → default style. VA can override via `styleOverride`.
 */
function defaultStyleFor(niche: CreatorContext["niche"]): CoverStyle {
  switch (niche) {
    case "spiritual":
    case "yoga":
    case "relationships":
      return "illustrated";
    case "business":
    case "money":
    case "fitness":
      return "photographic";
    default:
      return "photographic";
  }
}

/**
 * Niche → one-line background/mood hint. Keeps the prompt grounded in
 * something more specific than "vibrant colors". The image model still
 * owns the actual rendering; this just biases it.
 */
function moodFor(niche: CreatorContext["niche"]): string {
  switch (niche) {
    case "spiritual":
      return "Soft ethereal background — candlelight, natural textures, muted golds and deep teals.";
    case "yoga":
      return "Calm studio or natural outdoor background — morning light, sage and cream tones.";
    case "relationships":
      return "Warm domestic background — soft neutrals, blush and terracotta accents.";
    case "business":
      return "Clean modern background — city skyline blur or minimalist gradient in confident navy/charcoal.";
    case "money":
      return "Premium background — deep green, matte gold accents, subtle geometric texture.";
    case "fitness":
      return "Energetic background — gym or outdoor setting, motion-blurred ambient, high-contrast color block.";
    default:
      return "Clean professional background, tasteful gradient, modern feel.";
  }
}

export function buildImagePrompt(input: {
  creator: CreatorContext;
  transformationLine?: string;
  styleOverride?: CoverStyle;
}): string {
  const { creator, transformationLine, styleOverride } = input;
  const style = STYLES[styleOverride ?? defaultStyleFor(creator.niche)];
  const mood = moodFor(creator.niche);

  const taglineBlock = transformationLine
    ? `Supporting text (smaller, below or beside the title): "${transformationLine}"`
    : "No supporting text — keep the composition uncluttered.";

  return [
    `A bold, professional community cover image for a Skool community.`,
    `Aspect ratio 16:9 (1456x816). Composition designed for Skool's cover slot — title legible at small sizes.`,
    `Primary text overlay: "${creator.community_name}" — large, bold, modern sans-serif, extremely legible, placed in a clear zone of the image.`,
    `${creator.name} appears on one side of the composition (use the reference image for likeness), looking toward the camera with a warm, confident expression.`,
    mood,
    style.description,
    taglineBlock,
    `Vibrant colors, high contrast, professional commercial quality, modern community cover aesthetic.`,
    `Hard constraints: no gibberish or garbled text anywhere in the image; every character of the title must be spelled exactly as written; no extra watermarks or logos; no malformed hands, fingers, or facial features; typography must be crisp and readable.`,
  ].join("\n");
}
