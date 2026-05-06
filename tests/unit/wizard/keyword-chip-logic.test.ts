import { describe, expect, test } from "vitest";
import {
  commitChip,
  removeChipAt,
} from "@/components/wizard/keyword-chip-logic";

describe("commitChip", () => {
  test("appends a trimmed keyword and reports committed", () => {
    const r = commitChip(["yoga"], "  mindfulness  ", 11);
    expect(r).toEqual({
      values: ["yoga", "mindfulness"],
      committed: true,
    });
  });

  test("rejects a blank or whitespace-only draft", () => {
    expect(commitChip(["yoga"], "   ", 11)).toEqual({
      values: ["yoga"],
      committed: false,
    });
  });

  test("dedupes silently — same keyword stays at one entry", () => {
    expect(commitChip(["yoga"], "yoga", 11)).toEqual({
      values: ["yoga"],
      committed: false,
    });
  });

  test("dedupes after trimming — surrounding whitespace doesn't bypass", () => {
    expect(commitChip(["yoga"], " yoga ", 11)).toEqual({
      values: ["yoga"],
      committed: false,
    });
  });

  test("refuses when max is reached", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `kw${i}`);
    expect(commitChip(eleven, "twelfth", 11)).toEqual({
      values: eleven,
      committed: false,
    });
  });

  test("accepts up to max-1 then rejects max+1", () => {
    let values: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      values = commitChip(values, `kw${i}`, 5).values;
    }
    expect(values).toHaveLength(5);
    const r = commitChip(values, "overflow", 5);
    expect(r.committed).toBe(false);
    expect(r.values).toBe(values);
  });
});

describe("removeChipAt", () => {
  test("removes the entry at the given index", () => {
    expect(removeChipAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  test("returns the same array reference for out-of-range index", () => {
    const input = ["a", "b"];
    expect(removeChipAt(input, -1)).toBe(input);
    expect(removeChipAt(input, 2)).toBe(input);
  });

  test("does not mutate the input", () => {
    const input = ["a", "b", "c"];
    const out = removeChipAt(input, 0);
    expect(input).toEqual(["a", "b", "c"]);
    expect(out).toEqual(["b", "c"]);
  });
});
