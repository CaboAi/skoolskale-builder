import { describe, expect, test } from "vitest";
import {
  DASHBOARD_MODULE_KEYS,
  MODULE_KEYS,
  MODULE_LABELS,
  MODULE_REGISTRY,
  type CardVariant,
  type GeneratorKind,
  type ModuleKey,
} from "@/lib/modules/registry";

/**
 * Regression: chore/remove-image-generation strips the four image
 * modules (cover, icon, classroom_cover, calendar_cover) and the
 * "gemini-image" generator kind / "image-variants" + "image-single"
 * card variants. The active module count drops from 13 to 9. These
 * assertions pin the new shape so any accidental reintroduction
 * fails fast.
 */

const TEXT_MODULE_KEYS: readonly ModuleKey[] = [
  "welcome_dm",
  "transformation",
  "about_us",
  "start_here",
  "classroom",
  "calendar",
  "leaderboard",
  "categories",
  "discovery_seo",
];

const REMOVED_IMAGE_KEYS = [
  "cover",
  "icon",
  "classroom_cover",
  "calendar_cover",
] as const;

describe("MODULE_REGISTRY shape", () => {
  test("exposes exactly the 9 text modules — no image modules", () => {
    expect(new Set(MODULE_KEYS)).toEqual(new Set(TEXT_MODULE_KEYS));
    expect(MODULE_KEYS).toHaveLength(9);
  });

  test.each(REMOVED_IMAGE_KEYS)("removed image module %s is NOT in the registry", (key) => {
    expect(MODULE_KEYS).not.toContain(key);
    expect((MODULE_REGISTRY as Record<string, unknown>)[key]).toBeUndefined();
    expect(MODULE_LABELS[key]).toBeUndefined();
  });

  test("every module is includedByDefault — dashboard count matches total module count", () => {
    const total = Object.values(MODULE_REGISTRY).length;
    const defaultOn = Object.values(MODULE_REGISTRY).filter(
      (m) => m.includedByDefault,
    ).length;
    expect(DASHBOARD_MODULE_KEYS).toHaveLength(total);
    expect(defaultOn).toBe(total);
    expect(total).toBe(9);
  });

  test("every module's generatorKind is 'claude-text' — no gemini-image left", () => {
    const kinds = new Set<GeneratorKind>(
      Object.values(MODULE_REGISTRY).map((m) => m.generatorKind),
    );
    expect(kinds).toEqual(new Set<GeneratorKind>(["claude-text"]));
  });

  test("every module's cardVariant is one of the 6 surviving text-card variants", () => {
    const allowed = new Set<CardVariant>([
      "simple-text",
      "about-us",
      "start-here",
      "leaderboard",
      "repeater",
      "chips",
    ]);
    for (const m of Object.values(MODULE_REGISTRY)) {
      expect(allowed.has(m.cardVariant)).toBe(true);
    }
  });

  test("no module carries hasVariants / showEdit / fullWidth (those were image-only)", () => {
    for (const m of Object.values(MODULE_REGISTRY)) {
      const loose = m as unknown as Record<string, unknown>;
      expect(loose.hasVariants).toBeUndefined();
      expect(loose.showEdit).toBeUndefined();
      expect(loose.fullWidth).toBeUndefined();
    }
  });
});

describe("Package status math", () => {
  test('"X of Y modules approved" denominator reflects the post-cut count (9, not 13)', () => {
    const totalModules = Object.values(MODULE_REGISTRY).filter(
      (m) => m.includedByDefault,
    ).length;
    expect(totalModules).toBe(9);
  });
});
