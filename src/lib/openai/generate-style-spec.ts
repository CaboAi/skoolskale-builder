import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { ImageStyleSpecSchema } from "@/lib/images/style-spec";

/**
 * Style-spec derivation via OpenAI Structured Outputs.
 *
 * Runs once per package (the "Pin art direction" action), not per image.
 *
 * OpenAI rather than Claude on Mario's call: he has been art-directing these
 * covers by hand with GPT and rates its judgement here, and keeping the whole
 * images phase on one provider key means one thing to configure.
 *
 * `strict: true` json_schema means the response is schema-valid by
 * construction — no tag scraping, no parser, no repair pass. `mergeStyleSpec`
 * downstream still validates, because "the API guaranteed it" is not a reason
 * to skip a cheap check on something that steers a 12-image run.
 */

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export const STYLE_SPEC_MODEL = "gpt-5";
const STYLE_SPEC_TIMEOUT_MS = 120_000;

/** Cost per 1M tokens. TODO(pricing): confirm when the key lands. */
const PRICING = { inputPerM: 1.25, imageInputPerM: 1.25, outputPerM: 10 };

export type StyleSpecUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
};

export type GenerateStyleSpecResult = {
  /** Raw JSON string — handed to mergeStyleSpec, which owns validation. */
  raw: string;
  usage: StyleSpecUsage;
};

type ResponsesApiPayload = {
  output_text?: string;
  output?: {
    content?: { type?: string; text?: string }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

/**
 * Structured Outputs requires a JSON Schema, and requires every property to
 * be listed in `required` with `additionalProperties: false`. Zod's own
 * conversion emits optionals for defaulted fields, which the strict mode
 * rejects — so the schema is derived and then tightened here rather than
 * hand-maintained in parallel with the Zod source of truth.
 */
export function buildStyleSpecJsonSchema(): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(ImageStyleSpecSchema, {
    target: "draft-2020-12",
    io: "input",
  }) as Record<string, unknown>;

  const tighten = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(tighten);
    if (typeof node !== "object" || node === null) return node;

    const obj = { ...(node as Record<string, unknown>) };
    for (const [key, value] of Object.entries(obj)) {
      obj[key] = tighten(value);
    }
    if (obj.type === "object" && obj.properties) {
      obj.additionalProperties = false;
      obj.required = Object.keys(obj.properties as Record<string, unknown>);
    }
    // `default` is not part of strict Structured Outputs; the model must
    // supply every field explicitly.
    delete obj.default;
    return obj;
  };

  return tighten(jsonSchema) as Record<string, unknown>;
}

function requireApiKey(): string {
  const key = env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "[openai-style-spec] OPENAI_API_KEY is not configured — set it in .env.local and Vercel before pinning art direction",
    );
  }
  return key;
}

function extractText(payload: ResponsesApiPayload): string {
  if (payload.output_text) return payload.output_text;
  const chunks =
    payload.output?.flatMap(
      (item) =>
        item.content
          ?.filter((c) => typeof c.text === "string")
          .map((c) => c.text as string) ?? [],
    ) ?? [];
  if (chunks.length === 0) {
    throw new Error("[openai-style-spec] response contained no text output");
  }
  return chunks.join("");
}

export async function generateStyleSpec(params: {
  systemPrompt: string;
  userMessage: string;
  /** The brand-kit image, so the palette comes off the real artwork. */
  brandKitImage?: { base64: string; mimeType: string };
  model?: string;
}): Promise<GenerateStyleSpecResult> {
  const apiKey = requireApiKey();
  const model = params.model ?? STYLE_SPEC_MODEL;
  const started = Date.now();

  const userContent: Record<string, unknown>[] = [
    { type: "input_text", text: params.userMessage },
  ];
  if (params.brandKitImage) {
    userContent.push({
      type: "input_image",
      image_url: `data:${params.brandKitImage.mimeType};base64,${params.brandKitImage.base64}`,
    });
  }

  const res = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: params.systemPrompt }],
        },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "image_style_spec",
          strict: true,
          schema: buildStyleSpecJsonSchema(),
        },
      },
    }),
    signal: AbortSignal.timeout(STYLE_SPEC_TIMEOUT_MS),
  });

  const body = await res.text();
  let payload: ResponsesApiPayload;
  try {
    payload = JSON.parse(body) as ResponsesApiPayload;
  } catch {
    throw new Error(
      `[openai-style-spec] non-JSON response (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `[openai-style-spec] ${res.status} ${res.statusText}: ${payload.error?.message ?? body.slice(0, 300)}`,
    );
  }

  const inputTokens = payload.usage?.input_tokens ?? 0;
  const outputTokens = payload.usage?.output_tokens ?? 0;

  return {
    raw: extractText(payload),
    usage: {
      model,
      inputTokens,
      outputTokens,
      costUsd: Number(
        (
          (inputTokens / 1_000_000) * PRICING.inputPerM +
          (outputTokens / 1_000_000) * PRICING.outputPerM
        ).toFixed(6),
      ),
      durationMs: Date.now() - started,
    },
  };
}
