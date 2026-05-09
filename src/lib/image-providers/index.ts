import "server-only";
import { geminiProvider } from "./gemini";
import type { ImageProvider } from "./types";

export type { ImageProvider, ImageGenerateArgs, ImageGenerateResult } from "./types";

/**
 * Single seam for the image-generation provider. Today this returns
 * Gemini unconditionally; future swaps (Ideogram, ChatGPT Image) read
 * an env var here and switch.
 *
 * Why a getter and not a top-level const: keeps test-time substitution
 * easy (vi.spyOn on this module) without bundling the provider eagerly.
 */
export function getImageProvider(): ImageProvider {
  return geminiProvider;
}
