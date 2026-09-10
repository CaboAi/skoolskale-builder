import { describe, expect, test } from "vitest";
import { regenerateNoteSuffix } from "@/prompts/_shared";

describe("regenerateNoteSuffix", () => {
  test("returns empty string when note is undefined", () => {
    expect(regenerateNoteSuffix(undefined)).toBe("");
  });

  test("returns empty string when note is null", () => {
    expect(regenerateNoteSuffix(null)).toBe("");
  });

  test("returns empty string when note is empty", () => {
    expect(regenerateNoteSuffix("")).toBe("");
  });

  test("returns empty string when note is whitespace-only", () => {
    expect(regenerateNoteSuffix("   \n\t  ")).toBe("");
  });

  test("returns priority-framed suffix when note is non-empty", () => {
    const out = regenerateNoteSuffix("make it more concise");
    expect(out).toBe(
      "\n\nUSER FEEDBACK TO INCORPORATE:\nmake it more concise\n\nTreat this feedback as priority guidance. If it conflicts with default style choices, the user feedback wins.",
    );
  });

  test("trims surrounding whitespace from the note", () => {
    const out = regenerateNoteSuffix("  shorter please  ");
    expect(out).toContain("USER FEEDBACK TO INCORPORATE:\nshorter please\n\n");
    expect(out).not.toContain("  shorter please  ");
  });

  test("starts with two newlines so it sits on its own block after caller content", () => {
    const out = regenerateNoteSuffix("anything");
    expect(out.startsWith("\n\n")).toBe(true);
  });
});
