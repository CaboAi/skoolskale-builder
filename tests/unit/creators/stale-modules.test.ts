import { describe, expect, test } from "vitest";
import {
  changedFields,
  FIELD_IMPACTS,
  staleModulesFor,
  type IntakeField,
} from "@/lib/creators/stale-modules";
import { DASHBOARD_MODULE_KEYS } from "@/lib/modules/registry";
import { creatorToIntake } from "@/lib/creators/to-intake";
import { makeCreator } from "../../prompts/handover/fixtures";

const BASE = creatorToIntake(makeCreator());

describe("FIELD_IMPACTS", () => {
  test("every intake field has an entry, so a new field cannot be forgotten", () => {
    const fields = Object.keys(BASE) as IntakeField[];
    const missing = fields.filter((f) => FIELD_IMPACTS[f] === undefined);
    expect(missing).toEqual([]);
  });

  test("every module named is one the dashboard actually renders", () => {
    const known = new Set<string>(DASHBOARD_MODULE_KEYS);
    const unknown = Object.values(FIELD_IMPACTS)
      .flat()
      .filter((m) => !known.has(m));
    expect([...new Set(unknown)]).toEqual([]);
  });
});

describe("staleModulesFor", () => {
  test("no changes means nothing is stale", () => {
    expect(staleModulesFor([])).toEqual([]);
  });

  test("renaming the community invalidates every text module", () => {
    expect(staleModulesFor(["community_name"])).toEqual([
      ...DASHBOARD_MODULE_KEYS,
    ]);
  });

  test("a leaderboard edit invalidates only the leaderboard", () => {
    expect(staleModulesFor(["leaderboard_levels"])).toEqual(["leaderboard"]);
  });

  test("modules affected by two fields are reported once", () => {
    const result = staleModulesFor(["classroom_titles", "calendar_intake"]);
    expect(result).toEqual(["start_here", "classroom", "calendar"]);
  });

  test("results come back in dashboard order, not the order fields were edited", () => {
    const forward = staleModulesFor(["categories", "name"]);
    const reversed = staleModulesFor(["name", "categories"]);
    expect(forward).toEqual(reversed);
  });
});

describe("changedFields", () => {
  test("an untouched snapshot reports no changes", () => {
    expect(changedFields(BASE, { ...BASE })).toEqual([]);
  });

  test("a scalar edit is reported by name", () => {
    const after = { ...BASE, community_name: "Align Skool" };
    expect(changedFields(BASE, after)).toEqual(["community_name"]);
  });

  test("a nested edit inside a jsonb field is detected", () => {
    const after = {
      ...BASE,
      pricing: { ...BASE.pricing, free_community: true },
    };
    expect(changedFields(BASE, after)).toEqual(["pricing"]);
  });

  test("an equal-but-new object is not reported as a change", () => {
    const after = { ...BASE, pricing: { ...BASE.pricing } };
    expect(changedFields(BASE, after)).toEqual([]);
  });

  test("several edits at once are all reported", () => {
    const after = {
      ...BASE,
      name: "Aaron Alexander",
      community_name: "Align Skool",
    };
    expect(changedFields(BASE, after).sort()).toEqual([
      "community_name",
      "name",
    ]);
  });
});
