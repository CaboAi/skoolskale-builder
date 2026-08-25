import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { OPENAI_API_KEY: "sk-test" } }));

import { buildStyleSpecJsonSchema } from "@/lib/openai/generate-style-spec";

/**
 * OpenAI Structured Outputs `strict: true` rejects a schema outright — the
 * request 400s before the model ever runs — unless EVERY object node sets
 * `additionalProperties: false` and lists EVERY property in `required`.
 * Zod's own conversion does not do that (it emits optionals for defaulted
 * fields), which is why the schema is tightened before it is sent.
 *
 * Without this test the failure surfaces on the first real call, after the
 * API key lands, as an opaque 400.
 */
type Node = Record<string, unknown>;

function walkObjects(node: unknown, visit: (n: Node, path: string) => void, path = "$") {
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkObjects(child, visit, `${path}[${i}]`));
    return;
  }
  if (typeof node !== "object" || node === null) return;

  const obj = node as Node;
  if (obj.type === "object" && obj.properties) visit(obj, path);

  for (const [key, value] of Object.entries(obj)) {
    walkObjects(value, visit, `${path}.${key}`);
  }
}

describe("style spec JSON schema (Structured Outputs strict mode)", () => {
  const schema = buildStyleSpecJsonSchema();

  test("every object node forbids additional properties", () => {
    const offenders: string[] = [];
    walkObjects(schema, (node, path) => {
      if (node.additionalProperties !== false) offenders.push(path);
    });
    expect(offenders).toEqual([]);
  });

  test("every object node marks all of its properties required", () => {
    const offenders: string[] = [];
    walkObjects(schema, (node, path) => {
      const props = Object.keys(node.properties as Node);
      const required = (node.required as string[] | undefined) ?? [];
      const missing = props.filter((p) => !required.includes(p));
      if (missing.length > 0) offenders.push(`${path}: ${missing.join(", ")}`);
    });
    expect(offenders).toEqual([]);
  });

  test("no `default` survives anywhere — strict mode rejects it", () => {
    const json = JSON.stringify(schema);
    expect(json).not.toContain('"default"');
  });

  test("the spec's own fields are present, so the model is asked for them", () => {
    const props = Object.keys(
      (schema as { properties: Node }).properties,
    ).sort();

    expect(props).toEqual(
      [
        "artDirection",
        "composition",
        "lighting",
        "motifs",
        "palette",
        "peoplePolicy",
        "specVersion",
        "textPolicy",
        "typography",
      ].sort(),
    );
  });

  test("the defaulted policy fields are demanded explicitly", () => {
    const required = (schema as { required: string[] }).required;
    expect(required).toContain("textPolicy");
    expect(required).toContain("peoplePolicy");
  });

  test("palette hex constraints survive the conversion", () => {
    const palette = (schema as { properties: Node }).properties.palette as Node;
    const primary = (palette.properties as Node).primary as Node;
    expect(primary.pattern).toContain("[0-9a-fA-F]{6}");
  });
});
