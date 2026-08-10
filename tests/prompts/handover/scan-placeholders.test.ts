import { describe, expect, test } from "vitest";
import type { HandoverDocKey } from "@/prompts/handover/deliverables";
import { scanPlaceholders } from "@/prompts/handover/scan-placeholders";

function doc(docKey: HandoverDocKey, contentMd: string) {
  return { docKey, contentMd };
}

describe("scanPlaceholders", () => {
  test("dedupes label variants on the text before the first ':'", () => {
    const out = scanPlaceholders([
      doc(
        "vsl_and_cancellation",
        "intro [[CREATOR STORY: rock bottom]] middle [[CREATOR STORY: the comeback]] end",
      ),
    ]);
    expect(out).toEqual(["CREATOR STORY"]);
  });

  test("output is sorted regardless of document order", () => {
    const out = scanPlaceholders([
      doc("dm_sequences", "[[ZEBRA THING]] then [[ALPHA THING]]"),
    ]);
    expect(out).toEqual(["ALPHA THING", "ZEBRA THING"]);
  });

  test("readme docKey is skipped even when it contains tokens", () => {
    const out = scanPlaceholders([
      doc("readme", "boilerplate [[SHOULD NOT APPEAR: readme example]]"),
      doc("pre_launch_emails", "body [[EVENT DATE]]"),
    ]);
    expect(out).toEqual(["EVENT DATE"]);
  });

  test("empty docs array yields an empty list", () => {
    expect(scanPlaceholders([])).toEqual([]);
  });

  test("a doc without tokens yields an empty list", () => {
    expect(scanPlaceholders([doc("dm_sequences", "no tokens here")])).toEqual(
      [],
    );
  });

  test("a token with an empty label before ':' is excluded", () => {
    const out = scanPlaceholders([
      doc("post_launch_emails", "x [[: anonymous]] y [[REAL LABEL: keep me]]"),
    ]);
    expect(out).toEqual(["REAL LABEL"]);
  });

  test("labels are whitespace-trimmed", () => {
    const out = scanPlaceholders([
      doc("docuseries_full_script", "a [[ SPACED LABEL : with padding]] b"),
    ]);
    expect(out).toEqual(["SPACED LABEL"]);
  });

  test("multiple docs merge and dedupe across files", () => {
    const out = scanPlaceholders([
      doc("vsl_and_cancellation", "[[EVENT DATE]] and [[PROOF: a real win]]"),
      doc("docuseries_full_script", "[[EVENT DATE]] and [[CREATOR STORY: origin]]"),
    ]);
    expect(out).toEqual(["CREATOR STORY", "EVENT DATE", "PROOF"]);
  });
});
