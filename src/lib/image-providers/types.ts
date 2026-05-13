import "server-only";

/**
 * Provider-agnostic contract for image generation.
 *
 * The current default provider is Gemini Nano Banana 2 (see ./gemini.ts).
 * Future swaps (Ideogram, ChatGPT Image, etc.) implement this interface
 * and get registered in ./index.ts. Callers stay unchanged.
 *
 * Note on width/height: Gemini Nano Banana doesn't accept dimensions as
 * a parameter — prompts embed dimensions in their text. We still pass
 * width/height through the interface so future providers that DO accept
 * dimensions (Ideogram, ChatGPT Image) can use them without a contract
 * change.
 */
/**
 * Reference image source. Prefer `{ kind: 'storage', bucket, path }` —
 * the implementation reads bytes via the service-role client, which
 * survives Stage 4's private-bucket flip without code changes. URL form
 * remains for ad-hoc callers (CLIs, tests).
 */
export type ReferenceImageSource =
  | { kind: "url"; url: string }
  | { kind: "storage"; bucket: string; path: string };

export type ImageGenerateArgs = {
  prompt: string;
  referenceImage?: ReferenceImageSource;
  numVariants: number;
  width: number;
  height: number;
  packageId: string;
  /**
   * generation_jobs row id this call belongs to. Usage logging skips
   * when omitted (ad-hoc CLIs, tests).
   */
  jobId?: string;
  model?: string;
};

export type ImageGenerateResult = {
  images: Buffer[];
  costUsd: number;
  modelUsed: string;
};

export interface ImageProvider {
  readonly name: string;
  generate(args: ImageGenerateArgs): Promise<ImageGenerateResult>;
}
