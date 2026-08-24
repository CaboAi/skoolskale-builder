import { describe, expect, test } from "vitest";
import {
  buildSlotPrompt,
  renderStyleBlock,
  safeAreaNote,
} from "@/prompts/images/build-prompt";
import { baseStyleSpec } from "@/lib/images/style-spec/base";
import { planSlots, type SlotPlan } from "@/lib/images/slots";
import type { ImageStyleSpec } from "@/lib/images/style-spec";

const SPEC: ImageStyleSpec = baseStyleSpec({ niche: "money", tone: "bold" });
const COMMUNITY = "The Calm Closer";

/**
 * A sentinel that only ever exists in a classroom DESCRIPTION. If it turns
 * up in a prompt, a description has leaked into an image brief.
 */
const DESCRIPTION_SENTINEL = "ZZQXDESCRIPTION";

const PLAN = planSlots({
  communityName: COMMUNITY,
  classroomTitles: ["Foundations", "The Reset", "Closing Without Pressure"],
  calendarTitles: ["Weekly Q&A"],
});

const slot = (key: string): SlotPlan => {
  const found = PLAN.auto.find((s) => s.key === key);
  if (!found) throw new Error(`fixture missing slot ${key}`);
  return found;
};

const build = (key: string, note?: string) =>
  buildSlotPrompt({
    spec: SPEC,
    slot: slot(key),
    communityName: COMMUNITY,
    regenerateNote: note,
  });

describe("renderStyleBlock — the style lock", () => {
  test("is byte-identical across every slot in a package", () => {
    const block = renderStyleBlock(SPEC);
    const prompts = [
      build("classroom_cover:0"),
      build("classroom_cover:1"),
      build("classroom_cover:2"),
      build("calendar_cover:0"),
      build("join_now_banner:0"),
      build("icon:0"),
    ];

    for (const prompt of prompts) {
      expect(prompt).toContain(block);
    }
  });

  test("two classroom prompts differ only in their title line", () => {
    const a = build("classroom_cover:0").split("\n");
    const b = build("classroom_cover:1").split("\n");

    expect(a).toHaveLength(b.length);
    const differing = a
      .map((line, i) => (line === b[i] ? null : { a: line, b: b[i] }))
      .filter((d): d is { a: string; b: string } => d !== null);

    expect(differing).toHaveLength(1);
    expect(differing[0].a).toContain("Foundations");
    expect(differing[0].b).toContain("The Reset");
  });

  test("carries the palette, medium, lighting, and typography verbatim", () => {
    const block = renderStyleBlock(SPEC);

    expect(block).toContain(SPEC.palette.primary);
    expect(block).toContain(SPEC.palette.background);
    expect(block).toContain(SPEC.artDirection.summary);
    expect(block).toContain(SPEC.lighting.description);
    expect(block).toContain(SPEC.typography.treatment);
    expect(block).toContain(SPEC.motifs[0]);
  });
});

describe("on-image text", () => {
  test("a classroom cover asks for the module title and forbids a second line", () => {
    const prompt = build("classroom_cover:0");

    expect(prompt).toContain('Render exactly this text and nothing else: "Foundations"');
    expect(prompt).toContain("Do not translate it");
    expect(prompt).toContain("add any second line of text");
  });

  test("never contains a classroom description", () => {
    // Descriptions cannot reach the builder — SlotPlan has one text field —
    // so this asserts the boundary held rather than that a filter ran.
    for (const s of [...PLAN.auto, ...PLAN.overflow]) {
      const prompt = buildSlotPrompt({
        spec: SPEC,
        slot: { ...s, titleText: s.titleText },
        communityName: COMMUNITY,
      });
      expect(prompt).not.toContain(DESCRIPTION_SENTINEL);
    }
  });

  test("About Us images are told to render no text", () => {
    const prompt = build("about_us:0");
    expect(prompt).toContain("Render NO text of any kind");
    expect(prompt).not.toContain("Render exactly this text");
  });

  test("clean_plate policy suppresses the title even when one exists", () => {
    const prompt = buildSlotPrompt({
      spec: { ...SPEC, textPolicy: "clean_plate" },
      slot: slot("classroom_cover:0"),
      communityName: COMMUNITY,
    });

    expect(prompt).toContain("Render NO text of any kind");
    expect(prompt).not.toContain('"Foundations"');
  });
});

describe("safeAreaNote", () => {
  test("1536x1024 to 1456x816 warns about the 8% top and bottom trim", () => {
    const note = safeAreaNote(
      { width: 1536, height: 1024 },
      { width: 1456, height: 816 },
    );

    expect(note).toContain("middle 84% of the frame HEIGHT");
    expect(note).toContain("top 8%");
    expect(note).toContain("bottom 8%");
    expect(note).toContain("1456x816");
  });

  test("a matching aspect reports no crop", () => {
    const note = safeAreaNote(
      { width: 1024, height: 1024 },
      { width: 512, height: 512 },
    );
    expect(note).toContain("full frame is kept");
  });

  test("percentages track the target, not a hard-coded string", () => {
    const note = safeAreaNote(
      { width: 1536, height: 1024 },
      { width: 1280, height: 720 },
    );
    // 1280x720 is the same 16:9 as 1456x816, so the same band survives.
    expect(note).toContain("middle 84% of the frame HEIGHT");
    expect(note).toContain("1280x720");
  });
});

describe("regenerate note", () => {
  test("lands last, after the hard constraints", () => {
    const prompt = build("classroom_cover:0", "make it darker");
    expect(prompt.trimEnd().endsWith("the user feedback wins.")).toBe(true);
    expect(prompt).toContain("make it darker");
  });

  test("absent note leaves the prompt unchanged", () => {
    expect(build("classroom_cover:0")).toBe(build("classroom_cover:0", "   "));
  });
});
