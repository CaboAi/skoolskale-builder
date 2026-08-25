import { describe, expect, test, vi } from "vitest";
import {
  ImageStyleSpecSchema,
  STYLE_SPEC_VERSION,
  type ImageStyleSpec,
} from "@/lib/images/style-spec";
import { baseStyleSpec } from "@/lib/images/style-spec/base";
import { mergeStyleSpec } from "@/lib/images/style-spec/derive";

const BASE: ImageStyleSpec = baseStyleSpec({ niche: "money", tone: "bold" });

const NICHES = [
  "spiritual",
  "business",
  "fitness",
  "relationships",
  "money",
  "yoga",
  "other",
] as const;

const TONES = [
  "warm",
  "direct",
  "playful",
  "authoritative",
  "inspirational",
  "bold",
] as const;

describe("baseStyleSpec", () => {
  test("every niche and tone combination produces a schema-valid spec", () => {
    for (const niche of NICHES) {
      for (const tone of TONES) {
        const spec = baseStyleSpec({ niche, tone });
        expect(ImageStyleSpecSchema.safeParse(spec).success).toBe(true);
      }
    }
  });

  test("niche drives palette and medium; tone drives typography and layout", () => {
    const moneyBold = baseStyleSpec({ niche: "money", tone: "bold" });
    const moneyWarm = baseStyleSpec({ niche: "money", tone: "warm" });
    const fitnessBold = baseStyleSpec({ niche: "fitness", tone: "bold" });

    expect(moneyBold.palette).toEqual(moneyWarm.palette);
    expect(moneyBold.artDirection.medium).toBe(moneyWarm.artDirection.medium);
    expect(moneyBold.typography).toEqual(fitnessBold.typography);
    expect(moneyBold.typography).not.toEqual(moneyWarm.typography);
  });

  test("carries the universal guardrails every spec needs", () => {
    expect(BASE.artDirection.forbidden).toContain(
      "gibberish or garbled lettering",
    );
    expect(BASE.peoplePolicy).toBe("no_people");
    expect(BASE.textPolicy).toBe("in_image");
  });
});

describe("ImageStyleSpecSchema", () => {
  test("rejects a palette entry that is not #rrggbb", () => {
    const bad = { ...BASE, palette: { ...BASE.palette, primary: "cornflower" } };
    const result = ImageStyleSpecSchema.safeParse(bad);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("#rrggbb");
  });

  test("rejects prose long enough to swamp the slot instruction", () => {
    const bad = {
      ...BASE,
      artDirection: { ...BASE.artDirection, summary: "x".repeat(401) },
    };
    expect(ImageStyleSpecSchema.safeParse(bad).success).toBe(false);
  });

  test("rejects too few mood keywords and too many motifs", () => {
    expect(
      ImageStyleSpecSchema.safeParse({
        ...BASE,
        artDirection: { ...BASE.artDirection, moodKeywords: ["one", "two"] },
      }).success,
    ).toBe(false);

    expect(
      ImageStyleSpecSchema.safeParse({
        ...BASE,
        motifs: Array.from({ length: 7 }, (_, i) => `motif ${i}`),
      }).success,
    ).toBe(false);
  });

  test("rejects an unknown enum value rather than passing it to the model", () => {
    const bad = {
      ...BASE,
      artDirection: { ...BASE.artDirection, medium: "claymation" },
    };
    expect(ImageStyleSpecSchema.safeParse(bad).success).toBe(false);
  });

  test("applies defaults for textPolicy and peoplePolicy", () => {
    const withoutPolicies: Record<string, unknown> = { ...BASE };
    delete withoutPolicies.textPolicy;
    delete withoutPolicies.peoplePolicy;

    const parsed = ImageStyleSpecSchema.parse(withoutPolicies);
    expect(parsed.textPolicy).toBe("in_image");
    expect(parsed.peoplePolicy).toBe("no_people");
  });

  test("pins the spec version so an older payload can be detected", () => {
    expect(BASE.specVersion).toBe(STYLE_SPEC_VERSION);
    expect(
      ImageStyleSpecSchema.safeParse({ ...BASE, specVersion: 0 }).success,
    ).toBe(false);
  });
});

describe("mergeStyleSpec", () => {
  test("layers a partial model response over the base", () => {
    const patch = JSON.stringify({
      palette: { primary: "#AA1122", description: "Model-chosen crimson lead." },
      motifs: ["single ascending line", "matte paper grain"],
    });

    const { spec, source, issue } = mergeStyleSpec(BASE, patch);

    expect(source).toBe("generated");
    expect(issue).toBeUndefined();
    expect(spec.palette.primary).toBe("#AA1122");
    // Untouched fields survive the merge.
    expect(spec.palette.background).toBe(BASE.palette.background);
    expect(spec.typography).toEqual(BASE.typography);
    // Arrays replace rather than concatenate.
    expect(spec.motifs).toEqual(["single ascending line", "matte paper grain"]);
  });

  test("falls back to base and warns when the JSON does not parse", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { spec, source, issue } = mergeStyleSpec(BASE, "{not json");

    expect(source).toBe("fallback");
    expect(spec).toEqual(BASE);
    expect(issue).toContain("did not parse");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  test("falls back to base and warns when the merged result fails validation", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { spec, source, issue } = mergeStyleSpec(
      BASE,
      JSON.stringify({ palette: { primary: "not-a-colour" } }),
    );

    expect(source).toBe("fallback");
    expect(spec).toEqual(BASE);
    expect(issue).toContain("palette.primary");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  test("never throws — a wobbly derivation must not fail a 12-image run", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const payload of ["", "null", "[]", '"a string"', "{}"]) {
      expect(() => mergeStyleSpec(BASE, payload)).not.toThrow();
    }
    warn.mockRestore();
  });

  test("accepts an already-parsed object as well as a string", () => {
    const { spec, source } = mergeStyleSpec(BASE, {
      palette: { accent: "#00FF7F" },
    });

    expect(source).toBe("generated");
    expect(spec.palette.accent).toBe("#00FF7F");
  });
});
