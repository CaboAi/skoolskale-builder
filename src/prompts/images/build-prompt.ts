/**
 * Slot prompt assembly.
 *
 * The consistency guarantee lives in this file's TYPE SIGNATURES, not in its
 * prose. `renderStyleBlock` takes the spec and NOTHING ELSE — there is no
 * slot parameter it could vary on, so every image in a package is briefed
 * with a byte-identical art direction. `buildSlotPrompt` appends what
 * changes (assignment, title, crop note) after that fixed block.
 *
 * The second half of the guarantee is upstream: `SlotPlan` carries exactly
 * one text field (`titleText`), so a classroom module's DESCRIPTION never
 * reaches this file and cannot leak into an image.
 *
 * Pure module.
 */
import { regenerateNoteSuffix } from "@/prompts/_shared";
import type { ImageStyleSpec } from "@/lib/images/style-spec";
import { SLOT_REGISTRY, type ProviderSize, type SlotPlan } from "@/lib/images/slots";

const MEDIUM_PHRASES: Record<ImageStyleSpec["artDirection"]["medium"], string> =
  {
    photographic: "photographic, shot on a full-frame camera",
    "3d_render": "a physically-based 3D render",
    flat_vector: "flat vector illustration",
    painterly: "a painterly illustration with visible brush texture",
    collage: "a textured collage",
    gradient_abstract: "a smooth gradient-based abstract composition",
  };

const LIGHTING_PHRASES: Record<ImageStyleSpec["lighting"]["key"], string> = {
  soft_diffused: "soft diffused light",
  hard_directional: "hard directional key light",
  rim_backlit: "rim backlight separating subject from ground",
  ambient_glow: "low ambient glow",
  studio_flat: "even flat studio light",
};

const LAYOUT_PHRASES: Record<ImageStyleSpec["composition"]["bannerLayout"], string> =
  {
    title_left_art_right:
      "title anchored on the left third, imagery occupying the right",
    title_centered: "title centred with imagery radiating around it",
    title_lower_third: "title held in the lower third beneath the imagery",
  };

const TYPE_FAMILY_PHRASES: Record<ImageStyleSpec["typography"]["family"], string> =
  {
    geometric_sans: "a geometric sans-serif",
    grotesque_sans: "a neutral grotesque sans-serif",
    humanist_sans: "a humanist sans-serif",
    modern_serif: "a high-contrast modern serif",
    condensed_sans: "a condensed sans-serif",
  };

const TYPE_CASE_PHRASES: Record<ImageStyleSpec["typography"]["case"], string> = {
  title_case: "Title Case",
  upper_case: "ALL CAPS",
  sentence_case: "Sentence case",
};

const PEOPLE_PHRASES: Record<ImageStyleSpec["peoplePolicy"], string> = {
  no_people: "No people anywhere in the frame.",
  creator_only:
    "The only person who may appear is the creator, matching the supplied headshot reference.",
  anonymous_silhouettes:
    "People may appear only as distant or silhouetted figures; no identifiable faces.",
};

function parseSize(size: ProviderSize): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}

/**
 * The crop the model cannot see.
 *
 * gpt-image-1 emits 1536x1024 (1.500); a Skool banner is 1456x816 (1.784).
 * Getting there means discarding ~8% of the frame height from the top and
 * the same from the bottom. Unwarned, the model centres a title in the full
 * frame and we guillotine it. Percentages are derived from the actual source
 * and target so a dimension change can't desync this prose from the crop.
 */
export function safeAreaNote(
  source: { width: number; height: number },
  target: { width: number; height: number },
): string {
  const sourceAspect = source.width / source.height;
  const targetAspect = target.width / target.height;

  if (Math.abs(sourceAspect - targetAspect) < 0.001) {
    return "The full frame is kept — no cropping. Still leave a comfortable margin around all text.";
  }

  if (targetAspect > sourceAspect) {
    // Target is wider: height is the constraint, crop top and bottom.
    const keptFraction = sourceAspect / targetAspect;
    const keptPct = Math.round(keptFraction * 100);
    const trimPct = Math.round(((1 - keptFraction) / 2) * 100);
    return `This image will be centre-cropped to ${target.width}x${target.height}: only the middle ${keptPct}% of the frame HEIGHT survives. Every piece of text and every critical subject must sit inside that central band — treat the top ${trimPct}% and bottom ${trimPct}% as bleed that will be cut away.`;
  }

  // Target is taller: width is the constraint, crop left and right.
  const keptFraction = targetAspect / sourceAspect;
  const keptPct = Math.round(keptFraction * 100);
  const trimPct = Math.round(((1 - keptFraction) / 2) * 100);
  return `This image will be centre-cropped to ${target.width}x${target.height}: only the middle ${keptPct}% of the frame WIDTH survives. Every piece of text and every critical subject must sit inside that central band — treat the left ${trimPct}% and right ${trimPct}% as bleed that will be cut away.`;
}

/**
 * The invariant block.
 *
 * Takes the spec and nothing else. If you are ever tempted to add a second
 * parameter here, that is the moment the style lock breaks — put the varying
 * material in `buildSlotPrompt` instead.
 */
export function renderStyleBlock(spec: ImageStyleSpec): string {
  const { artDirection, palette, lighting, composition, typography } = spec;

  return [
    `Medium: ${MEDIUM_PHRASES[artDirection.medium]}.`,
    `Art direction: ${artDirection.summary}`,
    `Mood: ${artDirection.moodKeywords.join(", ")}.`,
    `Colour palette — background ${palette.background}, surface ${palette.surface}, primary ${palette.primary}, accent ${palette.accent}. ${palette.description} Use these colours and no others; text on dark areas is ${palette.textOnDark}, text on light areas is ${palette.textOnLight}.`,
    `Lighting: ${LIGHTING_PHRASES[lighting.key]}. ${lighting.description}`,
    `Composition: ${LAYOUT_PHRASES[composition.bannerLayout]}. Depth is ${composition.depth}; negative space is ${composition.negativeSpace}. ${composition.description}`,
    `Typography: ${TYPE_FAMILY_PHRASES[typography.family]}, ${typography.weight} weight, set in ${TYPE_CASE_PHRASES[typography.case]}. ${typography.treatment}`,
    `Recurring motifs to draw from: ${spec.motifs.join("; ")}.`,
  ].join("\n");
}

function renderTextSection(spec: ImageStyleSpec, slot: SlotPlan): string {
  if (spec.textPolicy === "clean_plate") {
    return "Render NO text of any kind in this image. Leave the title area clean and unobstructed — the wording is composited afterwards.";
  }
  if (!slot.titleText) {
    return "Render NO text of any kind in this image. No words, no letterforms, no numerals.";
  }
  return [
    `Render exactly this text and nothing else: "${slot.titleText}"`,
    "Spell it character for character as written above. Do not translate it, rephrase it, abbreviate it, add a subtitle, add a caption, or add any second line of text.",
  ].join("\n");
}

export function buildSlotPrompt(input: {
  spec: ImageStyleSpec;
  slot: SlotPlan;
  communityName: string;
  regenerateNote?: string;
}): string {
  const { spec, slot, communityName, regenerateNote } = input;
  const cfg = SLOT_REGISTRY[slot.kind];

  const body = [
    "=== ART DIRECTION (IDENTICAL FOR EVERY IMAGE IN THIS PACKAGE) ===",
    renderStyleBlock(spec),
    "",
    "=== ASSIGNMENT ===",
    `This image is a ${cfg.label} for the online community "${communityName}".`,
    cfg.intent,
    safeAreaNote(parseSize(slot.sourceSize), slot.target),
    "",
    "=== ON-IMAGE TEXT ===",
    renderTextSection(spec, slot),
    "",
    "=== HARD CONSTRAINTS ===",
    PEOPLE_PHRASES[spec.peoplePolicy],
    ...spec.artDirection.forbidden.map((f) => `Avoid: ${f}.`),
    "No borders, frames, mockup shells, or device bezels. No UI chrome. Do not render a screenshot of a webpage.",
    "This is one of a set — it must sit beside the other images in this package and read as the same designer's work.",
  ].join("\n");

  return body + regenerateNoteSuffix(regenerateNote);
}
