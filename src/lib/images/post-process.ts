import "server-only";
import sharp from "sharp";

/**
 * Crop and resize a provider image down to its exact Skool spec.
 *
 * gpt-image-1 only emits 1024x1024, 1536x1024, and 1024x1536; Skool wants
 * 1456x816, 1280x720, and 512x512. `fit: "cover"` performs the crop and the
 * downscale in one pass.
 *
 * `position: "centre"` is deliberate and must not be swapped for
 * `sharp.strategy.attention`. The prompt tells the model, in computed
 * percentages, that the frame will be centre-cropped (see `safeAreaNote` in
 * src/prompts/images/build-prompt.ts) and asks it to keep text inside that
 * band. An attention crop would silently contradict the instruction the
 * image was generated under, and titles would drift out of frame.
 *
 * Runs inside the same Inngest step as the provider call so a step retry
 * redoes generate + crop + upload as one unit, and the bytes in storage are
 * always final-spec.
 */
export async function fitToTarget(
  input: Buffer,
  target: { width: number; height: number },
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const buffer = await sharp(input)
    .resize(target.width, target.height, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    // Alpha is preserved, which matters for the transparent-background icon.
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { buffer, width: target.width, height: target.height };
}
