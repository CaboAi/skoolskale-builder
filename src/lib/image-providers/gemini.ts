import "server-only";
import {
  DEFAULT_MODEL,
  generateCoverImages,
} from "@/lib/gemini-image/generate";
import type { ImageProvider } from "./types";

/**
 * Gemini Nano Banana 2 adapter for the ImageProvider interface.
 *
 * This is intentionally a thin passthrough to generateCoverImages — the
 * existing function already implements the timeout / no-retry / usage-log
 * contract we want. Width/height are accepted but ignored: Nano Banana
 * doesn't take dimensions as a parameter; prompts embed them in text.
 */
export const geminiProvider: ImageProvider = {
  name: "gemini-nano-banana",
  async generate(args) {
    const result = await generateCoverImages({
      prompt: args.prompt,
      referenceImage: args.referenceImage,
      numVariants: args.numVariants,
      packageId: args.packageId,
      jobId: args.jobId,
      model: args.model,
    });
    return {
      images: result.images,
      costUsd: result.costUsd,
      modelUsed: args.model ?? DEFAULT_MODEL,
    };
  },
};
