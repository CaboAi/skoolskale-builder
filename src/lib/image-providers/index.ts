import "server-only";
import { openAiImageProvider } from "@/lib/image-providers/openai";
import type { ImageProvider } from "@/lib/image-providers/types";

/**
 * Provider lookup.
 *
 * Deliberately a getter rather than an exported const — recovered from the
 * pre-#39 seam, which had the same shape for the same reason: a const is
 * captured at import time and can't be spied on, and it forces the provider
 * module (and its env access) to evaluate wherever this file is imported.
 *
 * Ideogram is the expected second implementation at client handover; when it
 * lands, this is the only file that chooses between them.
 */
export function getImageProvider(): ImageProvider {
  return openAiImageProvider;
}

export type {
  ImageGenerateArgs,
  ImageGenerateResult,
  ImageProvider,
  ReferenceImageSource,
} from "@/lib/image-providers/types";
