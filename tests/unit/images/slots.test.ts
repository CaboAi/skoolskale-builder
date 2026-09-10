import { describe, expect, test } from "vitest";
import {
  MAX_SLOTS_PER_RUN,
  SLOT_REGISTRY,
  findSlot,
  parseSlotKey,
  planSlots,
  slotKey,
  type SlotPlan,
} from "@/lib/images/slots";

const TEN_CLASSROOM_TITLES = Array.from(
  { length: 10 },
  (_, i) => `Module ${i + 1}`,
);
const TEN_CALENDAR_TITLES = Array.from(
  { length: 10 },
  (_, i) => `Event ${i + 1}`,
);

const SMALL_PACKAGE = {
  communityName: "The Calm Closer",
  classroomTitles: ["Foundations", "The Reset"],
  calendarTitles: ["Weekly Q&A"],
};

const MAX_PACKAGE = {
  communityName: "The Calm Closer",
  classroomTitles: TEN_CLASSROOM_TITLES,
  calendarTitles: TEN_CALENDAR_TITLES,
};

const kindsOf = (slots: SlotPlan[]) => slots.map((s) => s.kind);
const countKind = (slots: SlotPlan[], kind: string) =>
  slots.filter((s) => s.kind === kind).length;

describe("slotKey / parseSlotKey", () => {
  test("round-trips every registered kind", () => {
    for (const kind of Object.keys(SLOT_REGISTRY) as (keyof typeof SLOT_REGISTRY)[]) {
      expect(parseSlotKey(slotKey(kind, 3))).toEqual({ kind, index: 3 });
    }
  });

  test("rejects unknown kinds, non-numeric indexes, and extra segments", () => {
    expect(parseSlotKey("community_cover:0")).toBeNull();
    expect(parseSlotKey("classroom_cover:abc")).toBeNull();
    expect(parseSlotKey("classroom_cover:1:2")).toBeNull();
    expect(parseSlotKey("classroom_cover")).toBeNull();
  });
});

describe("SLOT_REGISTRY dimensions", () => {
  test("each kind declares the Skool spec it targets", () => {
    expect(SLOT_REGISTRY.icon.target).toEqual({ width: 512, height: 512 });
    expect(SLOT_REGISTRY.classroom_cover.target).toEqual({
      width: 1456,
      height: 816,
    });
    expect(SLOT_REGISTRY.calendar_cover.target).toEqual({
      width: 1456,
      height: 816,
    });
    expect(SLOT_REGISTRY.about_us.target).toEqual({ width: 1456, height: 816 });
    expect(SLOT_REGISTRY.start_here_thumb.target).toEqual({
      width: 1280,
      height: 720,
    });
    expect(SLOT_REGISTRY.join_now_banner.target).toEqual({
      width: 1456,
      height: 816,
    });
  });

  test("the icon is the only transparent, non-banner slot", () => {
    const transparent = Object.values(SLOT_REGISTRY).filter(
      (c) => c.background === "transparent",
    );
    expect(transparent.map((c) => c.kind)).toEqual(["icon"]);

    const nonBanner = Object.values(SLOT_REGISTRY).filter(
      (c) => c.family !== "banner",
    );
    expect(nonBanner.map((c) => c.kind)).toEqual(["icon"]);
  });
});

describe("planSlots", () => {
  test("a small package plans every slot with nothing in overflow", () => {
    const { auto, overflow } = planSlots(SMALL_PACKAGE);

    // 1 icon + 2 classroom + 1 calendar + 2 about_us + start_here + join_now
    expect(auto).toHaveLength(8);
    expect(overflow).toEqual([]);
  });

  test("never exceeds the run cap", () => {
    const { auto } = planSlots(MAX_PACKAGE);
    expect(auto).toHaveLength(MAX_SLOTS_PER_RUN);
  });

  test("quota protects the singleton brand slots from a 20-banner package", () => {
    const { auto } = planSlots(MAX_PACKAGE);

    // The whole point of quota-before-priority: without it, classroom covers
    // would eat all 12 and the package would ship with no icon.
    expect(countKind(auto, "icon")).toBe(1);
    expect(countKind(auto, "start_here_thumb")).toBe(1);
    expect(countKind(auto, "join_now_banner")).toBe(1);
    expect(countKind(auto, "about_us")).toBe(2);
    expect(countKind(auto, "classroom_cover")).toBe(4);
    expect(countKind(auto, "calendar_cover")).toBe(3);
  });

  test("overflow is the exact complement of auto", () => {
    const { auto, overflow } = planSlots(MAX_PACKAGE);
    const autoKeys = auto.map((s) => s.key);
    const overflowKeys = overflow.map((s) => s.key);

    expect(overflow).toHaveLength(25 - MAX_SLOTS_PER_RUN);
    expect(new Set([...autoKeys, ...overflowKeys]).size).toBe(25);
    expect(autoKeys.filter((k) => overflowKeys.includes(k))).toEqual([]);
  });

  test("the first banner-family slot is classroom_cover:0 — the style anchor", () => {
    const { auto } = planSlots(MAX_PACKAGE);
    const firstBanner = auto.find((s) => s.family === "banner");
    expect(firstBanner?.key).toBe("classroom_cover:0");
  });

  test("run order follows registry priority", () => {
    const { auto } = planSlots(SMALL_PACKAGE);
    expect(kindsOf(auto)).toEqual([
      "icon",
      "classroom_cover",
      "classroom_cover",
      "calendar_cover",
      "about_us",
      "about_us",
      "start_here_thumb",
      "join_now_banner",
    ]);
  });

  test("keys are ordinal, so retitling a module keeps its slot", () => {
    const before = planSlots(SMALL_PACKAGE);
    const after = planSlots({
      ...SMALL_PACKAGE,
      classroomTitles: ["Foundations", "The Reset — v2"],
    });

    expect(after.auto.map((s) => s.key)).toEqual(before.auto.map((s) => s.key));
    expect(findSlot(after, "classroom_cover:1")?.titleText).toBe(
      "The Reset — v2",
    );
  });

  test("titleText carries the module title verbatim and nothing else", () => {
    const { auto } = planSlots(SMALL_PACKAGE);
    const classroom = auto.filter((s) => s.kind === "classroom_cover");

    expect(classroom.map((s) => s.titleText)).toEqual([
      "Foundations",
      "The Reset",
    ]);
  });

  test("About Us slots carry no text at all", () => {
    const { auto } = planSlots(SMALL_PACKAGE);
    const aboutUs = auto.filter((s) => s.kind === "about_us");

    expect(aboutUs).toHaveLength(2);
    expect(aboutUs.every((s) => s.titleText === "")).toBe(true);
  });

  test("a package with no classroom or calendar intake still plans brand slots", () => {
    const { auto, overflow } = planSlots({
      communityName: "Bare Package",
      classroomTitles: [],
      calendarTitles: [],
    });

    expect(kindsOf(auto)).toEqual([
      "icon",
      "about_us",
      "about_us",
      "start_here_thumb",
      "join_now_banner",
    ]);
    expect(overflow).toEqual([]);
  });
});
