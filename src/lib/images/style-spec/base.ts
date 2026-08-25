/**
 * Deterministic style spec from niche + tone.
 *
 * Two jobs:
 *   1. It is the starting point handed to the model, so the model is
 *      refining a real art direction rather than inventing one cold.
 *   2. It is the fallback when the model's output fails schema validation.
 *      A wobbly derivation must never fail a run — it degrades to this.
 *
 * The niche/tone knowledge is carried forward from the pre-#39 image prompt
 * builders (`git show 0e4e694^:src/prompts/icon.ts`), with real hex values
 * where those files only had adjectives.
 *
 * Pure module.
 */
import type { CreatorContext } from "@/types/generators";
import {
  STYLE_SPEC_VERSION,
  type ImageStyleSpec,
} from "@/lib/images/style-spec";

type Niche = CreatorContext["niche"];
type Tone = CreatorContext["tone"];

type NichePreset = {
  medium: ImageStyleSpec["artDirection"]["medium"];
  summary: string;
  moodKeywords: string[];
  palette: Omit<ImageStyleSpec["palette"], "description">;
  paletteDescription: string;
  lighting: ImageStyleSpec["lighting"];
  motifs: string[];
};

const NICHE_PRESETS: Record<Niche, NichePreset> = {
  spiritual: {
    medium: "painterly",
    summary:
      "Contemplative painterly imagery with soft edges and natural texture. Candlelight and dusk hues, hand-made rather than manufactured, room to breathe in every frame.",
    moodKeywords: ["contemplative", "warm", "sacred", "still", "grounded"],
    palette: {
      background: "#1B1714",
      surface: "#2E2721",
      primary: "#C9A227",
      accent: "#4E7C6B",
      textOnDark: "#F5EFE6",
      textOnLight: "#1B1714",
    },
    paletteDescription:
      "Deep warm charcoal grounds, muted gold as the lead, deep teal as the counterweight.",
    lighting: {
      key: "ambient_glow",
      description:
        "Low ambient glow as if lit by candle or late sun, shadows soft and never crushed.",
    },
    motifs: ["candle flame", "woven natural fibre", "dawn horizon line"],
  },
  yoga: {
    medium: "photographic",
    summary:
      "Calm photographic imagery in natural light. Studio or outdoors at early morning, uncluttered surfaces, a body of empty space around the subject.",
    moodKeywords: ["calm", "spacious", "natural", "unhurried", "clean"],
    palette: {
      background: "#F3EFE7",
      surface: "#E4DDD0",
      primary: "#7C8C6F",
      accent: "#C88F65",
      textOnDark: "#F7F4EE",
      textOnLight: "#2B2A26",
    },
    paletteDescription:
      "Cream and sand base, sage green as the lead, warm clay as the accent.",
    lighting: {
      key: "soft_diffused",
      description:
        "Soft diffused morning light, gentle falloff, no hard shadow edges.",
    },
    motifs: ["morning light through cloth", "smooth stone", "open floor plane"],
  },
  relationships: {
    medium: "photographic",
    summary:
      "Warm domestic photography at intimate scale. Interiors that feel lived in, shallow focus, the sense of a moment rather than a set.",
    moodKeywords: ["warm", "intimate", "honest", "soft", "close"],
    palette: {
      background: "#2A211E",
      surface: "#F0E3DC",
      primary: "#C4756A",
      accent: "#E0B7A0",
      textOnDark: "#FBF3EE",
      textOnLight: "#2A211E",
    },
    paletteDescription:
      "Blush and terracotta over a warm neutral base; nothing cool in the frame.",
    lighting: {
      key: "soft_diffused",
      description:
        "Warm window light from one side, soft shadow, golden rather than white.",
    },
    motifs: ["shared table", "worn textile", "window light on a wall"],
  },
  business: {
    medium: "gradient_abstract",
    summary:
      "Clean modern abstraction with confident geometry. Minimal gradients, precise edges, an engineered feel that stays warm enough to be human.",
    moodKeywords: ["decisive", "modern", "precise", "confident", "clean"],
    palette: {
      background: "#0F1724",
      surface: "#1C2738",
      primary: "#3B82F6",
      accent: "#F2C14E",
      textOnDark: "#F4F7FB",
      textOnLight: "#0F1724",
    },
    paletteDescription:
      "Deep navy ground, a single confident blue, warm amber used sparingly as the accent.",
    lighting: {
      key: "studio_flat",
      description:
        "Even studio lighting with controlled falloff; clarity over drama.",
    },
    motifs: ["layered planes", "grid rhythm", "single rising line"],
  },
  money: {
    medium: "3d_render",
    summary:
      "Premium 3D-rendered forms with a matte finish. Weighted objects, subtle material texture, restraint rather than shine — expensive, not flashy.",
    moodKeywords: ["premium", "solid", "restrained", "assured", "tactile"],
    palette: {
      background: "#12211B",
      surface: "#1D3229",
      primary: "#2F6F53",
      accent: "#C2A14D",
      textOnDark: "#F2F7F4",
      textOnLight: "#12211B",
    },
    paletteDescription:
      "Deep green ground with matte gold accents; no chrome, no gloss.",
    lighting: {
      key: "rim_backlit",
      description:
        "Rim light separating form from ground, matte surfaces, soft specular only.",
    },
    motifs: ["stacked solid forms", "matte metal edge", "subtle relief texture"],
  },
  fitness: {
    medium: "photographic",
    summary:
      "High-energy photography with strong contrast and motion. Bold colour blocking, a sense of momentum carried by blur or diagonal composition.",
    moodKeywords: ["energetic", "bold", "kinetic", "strong", "direct"],
    palette: {
      background: "#141414",
      surface: "#242424",
      primary: "#E2483D",
      accent: "#F5C518",
      textOnDark: "#FFFFFF",
      textOnLight: "#141414",
    },
    paletteDescription:
      "Near-black ground with a hot red lead and a high-visibility yellow accent.",
    lighting: {
      key: "hard_directional",
      description:
        "Hard directional key light, deep shadows, strong edge definition.",
    },
    motifs: ["motion streak", "diagonal thrust", "textured floor surface"],
  },
  other: {
    medium: "gradient_abstract",
    summary:
      "Modern, professional abstraction with a tasteful gradient base. Clear focal hierarchy and generous space, adaptable to any subject.",
    moodKeywords: ["modern", "professional", "clear", "approachable"],
    palette: {
      background: "#151A21",
      surface: "#222A34",
      primary: "#5B8DEF",
      accent: "#E9B949",
      textOnDark: "#F5F7FA",
      textOnLight: "#151A21",
    },
    paletteDescription:
      "Neutral dark ground, one confident blue, warm accent for emphasis.",
    lighting: {
      key: "soft_diffused",
      description: "Soft even light, gentle gradient falloff, no harsh edges.",
    },
    motifs: ["layered gradient field", "clean geometric accent"],
  },
};

type TonePreset = {
  typography: ImageStyleSpec["typography"];
  composition: Pick<
    ImageStyleSpec["composition"],
    "bannerLayout" | "depth" | "negativeSpace"
  > & { description: string };
};

const TONE_PRESETS: Record<Tone, TonePreset> = {
  warm: {
    typography: {
      family: "humanist_sans",
      weight: "medium",
      case: "title_case",
      treatment:
        "Friendly humanist letterforms, relaxed spacing, no hard tracking.",
    },
    composition: {
      bannerLayout: "title_left_art_right",
      depth: "shallow",
      negativeSpace: "generous",
      description:
        "Title anchored left with the imagery breathing to its right; generous margin all round.",
    },
  },
  direct: {
    typography: {
      family: "grotesque_sans",
      weight: "bold",
      case: "sentence_case",
      treatment: "Plain grotesque, tight but not cramped, zero ornament.",
    },
    composition: {
      bannerLayout: "title_left_art_right",
      depth: "flat",
      negativeSpace: "balanced",
      description:
        "Straightforward left-anchored title, flat staging, nothing decorative competing with it.",
    },
  },
  playful: {
    typography: {
      family: "geometric_sans",
      weight: "bold",
      case: "title_case",
      treatment:
        "Rounded geometric letterforms with a little bounce in the baseline.",
    },
    composition: {
      bannerLayout: "title_centered",
      depth: "shallow",
      negativeSpace: "balanced",
      description:
        "Centred title with playful asymmetry in the surrounding elements.",
    },
  },
  authoritative: {
    typography: {
      family: "modern_serif",
      weight: "medium",
      case: "title_case",
      treatment:
        "High-contrast modern serif, measured spacing, editorial restraint.",
    },
    composition: {
      bannerLayout: "title_lower_third",
      depth: "deep",
      negativeSpace: "generous",
      description:
        "Title held in the lower third beneath a deep, composed image; magazine-cover discipline.",
    },
  },
  inspirational: {
    typography: {
      family: "humanist_sans",
      weight: "medium",
      case: "title_case",
      treatment: "Open humanist letterforms with airy tracking.",
    },
    composition: {
      bannerLayout: "title_centered",
      depth: "deep",
      negativeSpace: "generous",
      description:
        "Centred title over an expansive scene with a clear horizon and room above.",
    },
  },
  bold: {
    typography: {
      family: "condensed_sans",
      weight: "black",
      case: "upper_case",
      treatment:
        "Heavy condensed caps, tight tracking, set large enough to dominate.",
    },
    composition: {
      bannerLayout: "title_left_art_right",
      depth: "flat",
      negativeSpace: "dense",
      description:
        "Oversized left-anchored title crowding the frame; imagery plays support.",
    },
  },
};

/** Constraints every spec carries regardless of niche or tone. */
const UNIVERSAL_FORBIDDEN = [
  "gibberish or garbled lettering",
  "watermarks or signatures",
  "stock-photo collage look",
  "malformed hands or faces",
];

export function baseStyleSpec(creator: {
  niche: Niche;
  tone: Tone;
}): ImageStyleSpec {
  const niche = NICHE_PRESETS[creator.niche] ?? NICHE_PRESETS.other;
  const tone = TONE_PRESETS[creator.tone] ?? TONE_PRESETS.warm;

  return {
    specVersion: STYLE_SPEC_VERSION,
    artDirection: {
      medium: niche.medium,
      summary: niche.summary,
      moodKeywords: niche.moodKeywords,
      forbidden: UNIVERSAL_FORBIDDEN,
    },
    palette: { ...niche.palette, description: niche.paletteDescription },
    lighting: niche.lighting,
    composition: tone.composition,
    typography: tone.typography,
    motifs: niche.motifs,
    textPolicy: "in_image",
    peoplePolicy: "no_people",
  };
}
