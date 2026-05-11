/**
 * Calendar-cover image prompt builder.
 *
 * Single-variant cover image used as the visual header of the Skool
 * "Calendar" tab. Themed around rhythm / events / cadence, visually
 * cohesive with the rest of the community.
 */
import { z } from "zod";
import type { CreatorContext } from "@/types/generators";

export const CalendarCoverContentSchema = z.object({
  variants: z.array(
    z.object({
      url: z.string().url(),
      index: z.number().int().min(0),
    }),
  ),
  selected_variant_index: z.number().int().min(0).optional(),
});

function moodForTone(tone: CreatorContext["tone"]): string {
  switch (tone) {
    case "warm":
      return "Tone: warm — soft natural light, gentle gradients, inviting rhythm.";
    case "direct":
      return "Tone: direct — clean composition, restrained palette, structured grid.";
    case "playful":
      return "Tone: playful — bright accents, lively angles, energetic layout.";
    case "authoritative":
      return "Tone: authoritative — premium feel, balanced symmetry, clean lines, controlled palette.";
    case "inspirational":
      return "Tone: inspirational — luminous light, expansive composition, hopeful upward motion.";
    case "bold":
      return "Tone: bold — high-contrast palette, dynamic angles, saturated colors, decisive composition.";
  }
}

function moodForNiche(niche: CreatorContext["niche"]): string {
  switch (niche) {
    case "spiritual":
    case "yoga":
      return "Soft natural light, sage and cream tones, gentle rhythm.";
    case "relationships":
      return "Warm interior, blush and terracotta accents, intimate scale.";
    case "business":
    case "money":
      return "Clean modern environment, deep navy or charcoal, decisive feel.";
    case "fitness":
      return "Bright high-energy lighting, bold color block.";
    default:
      return "Modern professional ambience.";
  }
}

export function buildCalendarCoverPrompt(input: {
  creator: CreatorContext;
}): string {
  const { creator } = input;
  return [
    `A horizontal banner image for the "Calendar" section of the Skool community "${creator.community_name}".`,
    `Aspect ratio 16:9 (1456x816). Designed as a sectional header — title legible at small sizes.`,
    `Visual concept: an evocative scene that reads as "rhythm, events, cadence" — abstract calendar grids, layered date markers, ambient symbols of weekly ritual. Modern and visual, not a literal calendar UI screenshot.`,
    `Primary text overlay: "Calendar" — large, bold, modern sans-serif, centered or left-anchored.`,
    `Secondary text (smaller): "${creator.community_name}".`,
    moodForNiche(creator.niche),
    moodForTone(creator.tone),
    `Niche cue: ${creator.niche}. Visual references should feel native to a ${creator.niche} community.`,
    `Hard constraints: no photographs of identifiable people; no gibberish or garbled text; both "Calendar" and "${creator.community_name}" must be spelled exactly as written; no watermarks; modern community-cover aesthetic.`,
  ].join("\n");
}
