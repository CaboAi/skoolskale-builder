/**
 * Image provider contract.
 *
 * Recovered from the seam deleted in PR #39 (`git show
 * 0e4e694^:src/lib/image-providers/types.ts`) and widened for gpt-image-1.
 * The seam exists because the provider is expected to change: Ideogram is
 * the planned swap at client handover, and the pipeline above this line
 * should not have to care.
 *
 * Pure module — types only.
 */
import type { ProviderSize } from "@/lib/images/slots";
import type { ImageTokenUsage } from "@/lib/images/usage";

/**
 * Where a reference image lives.
 *
 * `storage` is strongly preferred: it downloads under the service-role
 * client, which works regardless of bucket visibility and has no signed-URL
 * TTL to race against mid-generation. `url` exists for ad-hoc callers
 * (scripts, tests) that already hold one.
 */
export type ReferenceImageSource =
  | { kind: "url"; url: string }
  | { kind: "storage"; bucket: string; path: string };

export type ImageGenerateArgs = {
  prompt: string;
  /**
   * Ordered, and the order is meaningful: headshot, then brand kit, then the
   * style anchor. Empty or omitted routes to the text-to-image endpoint.
   */
  referenceImages?: ReferenceImageSource[];
  size: ProviderSize;
  quality: "low" | "medium" | "high";
  background: "opaque" | "transparent";
  /** Whether a reference is the creator's face, which raises input fidelity. */
  hasPortraitReference?: boolean;
  packageId: string;
  model?: string;
};

export type ImageGenerateResult = {
  /** Exactly one image. This phase has no variants by design. */
  image: Buffer;
  costUsd: number;
  modelUsed: string;
  durationMs: number;
  tokens?: ImageTokenUsage;
};

export interface ImageProvider {
  readonly name: string;
  generate(args: ImageGenerateArgs): Promise<ImageGenerateResult>;
}
