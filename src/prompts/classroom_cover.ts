/**
 * Classroom-cover image prompt builder.
 *
 * Single-variant cover image used as the visual header of the Skool
 * "Classroom" tab. Themed around learning / curriculum, but visually
 * cohesive with the main community cover (same creator, same niche
 * mood). No reference image — this is a sectional banner, not a
 * portrait.
 */
import { z } from "zod";
import type { CreatorContext } from "@/types/generators";

export const ClassroomCoverContentSchema = z.object({
  variants: z.array(
    z.object({
      url: z.string().url(),
      index: z.number().int().min(0),
    }),
  ),
  // Single-variant module — included for type symmetry with the
  // multi-variant image modules; never set in practice.
  selected_variant_index: z.number().int().min(0).optional(),
});

function moodForNiche(niche: CreatorContext["niche"]): string {
  switch (niche) {
    case "spiritual":
    case "yoga":
      return "Soft natural light, warm earth tones, contemplative atmosphere.";
    case "relationships":
      return "Warm domestic light, blush and terracotta accents.";
    case "business":
    case "money":
      return "Clean modern environment, deep navy or charcoal with one accent color, premium feel.";
    case "fitness":
      return "High-energy lighting, bold color block, motion-blurred background.";
    default:
      return "Modern, professional ambience, tasteful gradient.";
  }
}

export function buildClassroomCoverPrompt(input: {
  creator: CreatorContext;
}): string {
  const { creator } = input;
  return [
    `A horizontal banner image for the "Classroom" section of the Skool community "${creator.community_name}".`,
    `Aspect ratio 16:9 (1456x816). Designed as a sectional header — title legible at small sizes.`,
    `Visual concept: an evocative scene that reads as "learning, curriculum, structured progress" — open notebooks, layered shapes suggesting modules, ambient symbols of study. Not literally a classroom; abstract enough to feel modern.`,
    `Primary text overlay: "Classroom" — large, bold, modern sans-serif, centered or left-anchored in a clear zone of the image.`,
    `Secondary text (smaller, supporting): "${creator.community_name}" — confidently placed below or alongside the primary title.`,
    moodForNiche(creator.niche),
    `Niche cue: ${creator.niche}. Visual references should feel native to a ${creator.niche} community.`,
    `Hard constraints: no photographs of identifiable people; no gibberish or garbled text; both "Classroom" and "${creator.community_name}" must be spelled exactly as written; no watermarks; modern community-cover aesthetic.`,
  ].join("\n");
}
