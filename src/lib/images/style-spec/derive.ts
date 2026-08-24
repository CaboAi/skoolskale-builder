/**
 * Merge a model-produced style spec over the deterministic base.
 *
 * The model is asked for a full spec via Structured Outputs, so a valid
 * response is the normal case. This exists for the abnormal one: art
 * direction wobbling is never a good enough reason to fail a 12-image run,
 * so a malformed payload degrades to the niche/tone base and is RECORDED as
 * `fallback` rather than silently swallowed.
 *
 * Pure module.
 */
import {
  ImageStyleSpecSchema,
  type ImageStyleSpec,
} from "@/lib/images/style-spec";

export type StyleSpecSource = "generated" | "edited" | "fallback";

export type MergeStyleSpecResult = {
  spec: ImageStyleSpec;
  source: StyleSpecSource;
  /** Present only on the fallback path — the reason, for logging + the UI. */
  issue?: string;
};

type Json = Record<string, unknown>;

function isPlainObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge `patch` over `base`. Arrays replace wholesale rather than
 * concatenating — a model returning three motifs means three, not three
 * appended to the base's three.
 */
function deepMerge(base: Json, patch: Json): Json {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) continue;
    const existing = out[key];
    out[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMerge(existing, value)
        : value;
  }
  return out;
}

export function mergeStyleSpec(
  base: ImageStyleSpec,
  raw: string | unknown,
): MergeStyleSpecResult {
  let parsedJson: unknown;
  if (typeof raw === "string") {
    try {
      parsedJson = JSON.parse(raw);
    } catch (err) {
      const issue = `style spec JSON did not parse: ${(err as Error).message}`;
      console.warn(`[images/style-spec] ${issue} — falling back to base spec`);
      return { spec: base, source: "fallback", issue };
    }
  } else {
    parsedJson = raw;
  }

  if (!isPlainObject(parsedJson)) {
    const issue = "style spec payload was not an object";
    console.warn(`[images/style-spec] ${issue} — falling back to base spec`);
    return { spec: base, source: "fallback", issue };
  }

  const merged = deepMerge(base as unknown as Json, parsedJson);
  const result = ImageStyleSpecSchema.safeParse(merged);
  if (!result.success) {
    const issue = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    console.warn(
      `[images/style-spec] merged spec failed validation (${issue}) — falling back to base spec`,
    );
    return { spec: base, source: "fallback", issue };
  }

  return { spec: result.data, source: "generated" };
}
