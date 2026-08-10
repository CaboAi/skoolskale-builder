import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import {
  assertHandoverAssets,
  loadHandoverAsset,
} from "@/prompts/handover/load-assets";

// Spy-wrap node:fs (real implementation preserved) so the cache test can
// assert that repeat loads never hit the filesystem again.
vi.mock("node:fs", { spy: true });

describe("assertHandoverAssets", () => {
  test("all committed asset files are present and readable", () => {
    expect(() => assertHandoverAssets()).not.toThrow();
  });
});

describe("loadHandoverAsset", () => {
  test("voice-and-guardrails.md loads with its stable markers", () => {
    const text = loadHandoverAsset("voice-and-guardrails.md");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Voice & Guardrails — apply to EVERY deliverable");
    expect(text).toContain("No fabrication");
  });

  test("caches per name: repeat loads return the same value without re-reading disk", () => {
    const first = loadHandoverAsset("handover-structure.md");
    const readsAfterFirst = vi.mocked(readFileSync).mock.calls.length;
    const second = loadHandoverAsset("handover-structure.md");
    expect(second).toBe(first);
    expect(vi.mocked(readFileSync).mock.calls.length).toBe(readsAfterFirst);
  });
});
