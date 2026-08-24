/**
 * The visual style spec — the images phase's consistency contract.
 *
 * One spec is pinned per package and injected byte-identically into every
 * slot prompt, which is what makes eight classroom covers read as one
 * family instead of eight unrelated pictures.
 *
 * Design rules encoded in the schema itself:
 * - Every structural field is an enum, so the renderer is total: there is no
 *   free-text value that can quietly mean nothing to the model.
 * - Every free-text field is length-capped, so a model ramble can't swamp
 *   the slot instruction that follows it in the prompt.
 *
 * Pure module — no `server-only`. The edit dialog validates against this
 * exact schema client-side before PATCHing.
 */
import { z } from "zod";

const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb hex colour");

export const STYLE_SPEC_VERSION = 1;

export const ImageStyleSpecSchema = z.object({
  specVersion: z.literal(STYLE_SPEC_VERSION),

  artDirection: z.object({
    medium: z.enum([
      "photographic",
      "3d_render",
      "flat_vector",
      "painterly",
      "collage",
      "gradient_abstract",
    ]),
    summary: z.string().min(20).max(400),
    moodKeywords: z.array(z.string().min(2).max(30)).min(3).max(8),
    forbidden: z.array(z.string().min(2).max(60)).max(10).default([]),
  }),

  palette: z.object({
    background: HexColor,
    surface: HexColor,
    primary: HexColor,
    accent: HexColor,
    textOnDark: HexColor,
    textOnLight: HexColor,
    description: z.string().min(10).max(200),
  }),

  lighting: z.object({
    key: z.enum([
      "soft_diffused",
      "hard_directional",
      "rim_backlit",
      "ambient_glow",
      "studio_flat",
    ]),
    description: z.string().min(10).max(200),
  }),

  composition: z.object({
    bannerLayout: z.enum([
      "title_left_art_right",
      "title_centered",
      "title_lower_third",
    ]),
    depth: z.enum(["flat", "shallow", "deep"]),
    negativeSpace: z.enum(["generous", "balanced", "dense"]),
    description: z.string().min(10).max(240),
  }),

  typography: z.object({
    family: z.enum([
      "geometric_sans",
      "grotesque_sans",
      "humanist_sans",
      "modern_serif",
      "condensed_sans",
    ]),
    weight: z.enum(["regular", "medium", "bold", "black"]),
    case: z.enum(["title_case", "upper_case", "sentence_case"]),
    treatment: z.string().min(10).max(200),
  }),

  /** Recurring visual objects that tie the family together across slots. */
  motifs: z.array(z.string().min(3).max(60)).min(2).max(6),

  /**
   * `in_image` asks the model to render the title itself. `clean_plate` asks
   * for no text at all so it can be composited afterwards with real
   * typography. Defaults to `in_image`; the field exists so switching is a
   * config change rather than a rewrite when misspelled titles get annoying.
   */
  textPolicy: z.enum(["in_image", "clean_plate"]).default("in_image"),

  peoplePolicy: z
    .enum(["no_people", "creator_only", "anonymous_silhouettes"])
    .default("no_people"),
});

export type ImageStyleSpec = z.infer<typeof ImageStyleSpecSchema>;
export type ArtMedium = ImageStyleSpec["artDirection"]["medium"];
export type BannerLayout = ImageStyleSpec["composition"]["bannerLayout"];
