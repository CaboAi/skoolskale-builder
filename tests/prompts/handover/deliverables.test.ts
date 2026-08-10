import { describe, expect, test } from "vitest";
import { handoverDocKeyEnum } from "@/lib/db/schema";
import {
  HANDOVER_DELIVERABLES,
  HANDOVER_DOC_FILENAMES,
  HANDOVER_DOC_LABELS,
  HANDOVER_GENERATED_DOC_KEYS,
} from "@/prompts/handover/deliverables";

describe("handover doc keys", () => {
  test("readme + generated keys exactly match the DB handover_doc_key enum", () => {
    const local = new Set<string>(["readme", ...HANDOVER_GENERATED_DOC_KEYS]);
    expect(new Set(handoverDocKeyEnum.enumValues)).toEqual(local);
  });

  test("every doc key has a label and a filename", () => {
    const keys = ["readme", ...HANDOVER_GENERATED_DOC_KEYS] as const;
    for (const key of keys) {
      expect(HANDOVER_DOC_LABELS[key]).toBeTruthy();
      expect(HANDOVER_DOC_FILENAMES[key]).toMatch(/^\d{2}-.+\.md$/);
    }
  });
});

describe("HANDOVER_DELIVERABLES registry", () => {
  test("deliverables are ordered 01..05 and cover the generated keys in order", () => {
    expect(HANDOVER_DELIVERABLES.map((d) => d.num)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
    ]);
    expect(HANDOVER_DELIVERABLES.map((d) => d.docKey)).toEqual([
      ...HANDOVER_GENERATED_DOC_KEYS,
    ]);
  });

  test("each deliverable's num matches its filename prefix; readme is 00", () => {
    expect(HANDOVER_DOC_FILENAMES.readme).toBe("00-README.md");
    for (const d of HANDOVER_DELIVERABLES) {
      expect(HANDOVER_DOC_FILENAMES[d.docKey].startsWith(`${d.num}-`)).toBe(
        true,
      );
    }
  });

  test("every referenceAsset and templateAsset filename ends with .md", () => {
    for (const d of HANDOVER_DELIVERABLES) {
      expect(d.referenceAsset).toMatch(/\.md$/);
      for (const flag of [false, true]) {
        for (const asset of d.templateAssets(flag)) {
          expect(asset).toMatch(/\.md$/);
        }
      }
    }
  });
});

describe("pre_launch_emails guest gating", () => {
  const preLaunch = HANDOVER_DELIVERABLES.find(
    (d) => d.docKey === "pre_launch_emails",
  );
  if (!preLaunch) throw new Error("pre_launch_emails deliverable missing");

  test("templateAssets(false) excludes the guest example", () => {
    expect(preLaunch.templateAssets(false)).toEqual([
      "example-pre-launch-emails.md",
    ]);
  });

  test("templateAssets(true) includes the guest example", () => {
    expect(preLaunch.templateAssets(true)).toEqual([
      "example-pre-launch-emails.md",
      "example-pre-launch-guest-emails.md",
    ]);
  });

  test("buildTask(false) forbids the guest sequence and never confirms guests", () => {
    const task = preLaunch.buildTask(false);
    expect(task).toContain("Do NOT produce a guest-speaker");
    expect(task).not.toContain("CONFIRMED launch guests");
  });

  test("buildTask(true) confirms guests and drops the prohibition", () => {
    const task = preLaunch.buildTask(true);
    expect(task).toContain("CONFIRMED launch guests");
    expect(task).not.toContain("Do NOT produce a guest-speaker");
  });
});
