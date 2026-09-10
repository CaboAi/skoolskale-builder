import { describe, expect, test } from "vitest";
import {
  DASHBOARD_MODULE_KEYS,
  getMissingRequiredModules,
  MODULE_KEYS,
  MODULE_LABELS,
  MODULE_REGISTRY,
  REQUIRED_FOR_EXPORT,
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
  "first_post",
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
    expect(MODULE_KEYS).toHaveLength(10);
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
    expect(total).toBe(10);
  });

  test("every module's generatorKind is 'claude-text' — no gemini-image left", () => {
    const kinds = new Set<GeneratorKind>(
      Object.values(MODULE_REGISTRY).map((m) => m.generatorKind),
    );
    expect(kinds).toEqual(new Set<GeneratorKind>(["claude-text"]));
  });

  test("every module's cardVariant is one of the 7 text-card variants", () => {
    const allowed = new Set<CardVariant>([
      "simple-text",
      "about-us",
      "start-here",
      "title-body",
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
    expect(totalModules).toBe(10);
  });
});

/**
 * Lock the includedByDefault contract for the five add-on text modules.
 * They were initially `false` (waiting on the image generators in the
 * since-removed PR #7) and got flipped to `true` in
 * `feat/text-modules-default-on` once image generation went away.
 */
describe("Add-on text modules default-on contract", () => {
  const ADDON_MODULES: ModuleKey[] = [
    "classroom",
    "calendar",
    "leaderboard",
    "categories",
    "discovery_seo",
  ];

  test.each(ADDON_MODULES)("%s is includedByDefault: true", (key) => {
    expect(MODULE_REGISTRY[key].includedByDefault).toBe(true);
  });

  test("every registered module is default-on (no opt-in modules left)", () => {
    for (const m of Object.values(MODULE_REGISTRY)) {
      expect(m.includedByDefault).toBe(true);
    }
  });

  test("DASHBOARD_MODULE_KEYS contains every key (all 10 surface in the dashboard)", () => {
    expect(new Set(DASHBOARD_MODULE_KEYS)).toEqual(new Set(MODULE_KEYS));
  });
});

describe("first_post module config", () => {
  test("is registered with the title-body card variant and Skool-cap math", () => {
    const cfg = MODULE_REGISTRY.first_post;
    expect(cfg.label).toBe("First Post");
    expect(cfg.generatorKind).toBe("claude-text");
    expect(cfg.cardVariant).toBe("title-body");
    expect(cfg.includedByDefault).toBe(true);
    expect(cfg.eventName).toBe("generate.first_post.requested");
    // Body-only caps from src/prompts/first-post.ts.
    expect(cfg.targetChars).toBe(1800);
    expect(cfg.maxChars).toBe(2500);
  });
});

describe("getMissingRequiredModules", () => {
  const approvedAll = REQUIRED_FOR_EXPORT.map((module) => ({
    module,
    approved: true,
  }));

  test("returns [] when every export-required module has an approved asset", () => {
    expect(getMissingRequiredModules(approvedAll)).toEqual([]);
  });

  test("flags a required module that has no asset at all", () => {
    const withoutWelcome = approvedAll.filter((a) => a.module !== "welcome_dm");
    expect(getMissingRequiredModules(withoutWelcome)).toEqual(["welcome_dm"]);
  });

  test("flags a required module whose asset exists but is unapproved", () => {
    const welcomeUnapproved = approvedAll.map((a) =>
      a.module === "about_us" ? { ...a, approved: false } : a,
    );
    expect(getMissingRequiredModules(welcomeUnapproved)).toEqual(["about_us"]);
  });

  test("ignores non-required / unknown module rows", () => {
    const withStray = [
      ...approvedAll,
      { module: "cover", approved: false },
    ];
    expect(getMissingRequiredModules(withStray)).toEqual([]);
  });

  test("empty asset list means every required module is missing", () => {
    expect(getMissingRequiredModules([])).toEqual(REQUIRED_FOR_EXPORT);
  });
});
