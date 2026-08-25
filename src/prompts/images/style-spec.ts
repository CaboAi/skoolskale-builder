/**
 * Style-director prompt — derives the pinned art direction for a package.
 *
 * Runs ONCE per package (the "Pin art direction" action), not once per
 * image. Output is a full ImageStyleSpec, produced through OpenAI Structured
 * Outputs so the JSON is schema-guaranteed rather than parsed out of prose.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MARIO: your existing ChatGPT project instructions — the ones you have been
 * using by hand to make these covers — belong in STYLE_DIRECTOR_HOUSE_STYLE
 * below. Paste them in verbatim; everything around them (the JSON contract,
 * the schema enforcement, the field list) stays as is. The placeholder text
 * currently there is a working default, not a finished house style.
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { CreatorContext } from "@/types/generators";
import type { ImageStyleSpec } from "@/lib/images/style-spec";

/**
 * The house style. Replaced verbatim with Mario's ChatGPT project prompt.
 * Kept as its own export so swapping it is a one-constant edit and the
 * surrounding contract text is never accidentally clobbered.
 */
export const STYLE_DIRECTOR_HOUSE_STYLE = `House standards for Skool community artwork:

- Covers are read at thumbnail size first. Whatever is in the frame must be
  legible when it is 300px wide in a sidebar.
- One idea per image. A cover that tries to say three things says none.
- Restraint over decoration. No lens flares, no bevels, no drop shadows on
  type, no stock-photo gloss, no gradient meshes fighting the subject.
- Colour comes from a small palette used consistently, not from a rainbow.
- The typography is the design. If the type is weak the image is weak.
- Every cover in one community must look like it came from one designer on
  one afternoon.`;

export const STYLE_SPEC_SYSTEM_PROMPT = `You are the art director for a Skool community launch package. You are setting the visual identity that EVERY image in this package will follow — the community icon, every classroom module cover, every calendar event cover, the About Us imagery, and the conversion banners.

${STYLE_DIRECTOR_HOUSE_STYLE}

Your output is a single style specification object. It is injected verbatim into every image prompt that follows, so it must be:

1. SPECIFIC. "Modern and clean" is useless. Name the medium, the light, the palette, the layout.
2. CONSISTENT-BY-CONSTRUCTION. Every choice must work equally well on a square icon and on a wide banner.
3. COMPLETE. Fill every field. A vague field becomes a vague image.

You are given a starting specification derived from the community's niche and tone. Treat it as a competent first draft: keep what fits this specific community, change what does not, and justify nothing — return only the object.

If a brand-kit image is supplied, its colours and typographic feel take priority over the draft palette. Read the actual hex values off that image rather than approximating them from adjectives.`;

export function buildStyleSpecUserMessage(input: {
  creator: CreatorContext;
  dnaMarkdown: string;
  baseSpec: ImageStyleSpec;
  hasBrandKitImage: boolean;
}): string {
  const { creator, dnaMarkdown, baseSpec, hasBrandKitImage } = input;

  return [
    `<community>`,
    `Name: ${creator.community_name}`,
    `Creator: ${creator.name}`,
    `Niche: ${creator.niche}`,
    `Tone: ${creator.tone}`,
    `Audience: ${creator.audience}`,
    `Transformation promised: ${creator.transformation}`,
    `Stated brand preferences: ${creator.brand_prefs || "(none supplied)"}`,
    `</community>`,
    ``,
    `<community_dna>`,
    dnaMarkdown,
    `</community_dna>`,
    ``,
    `<starting_draft>`,
    JSON.stringify(baseSpec, null, 2),
    `</starting_draft>`,
    ``,
    hasBrandKitImage
      ? `A brand-kit image is attached. Derive the palette from it directly.`
      : `No brand-kit image was supplied. Derive the palette from the niche, tone, and stated brand preferences.`,
    ``,
    `Return the complete style specification.`,
  ].join("\n");
}
