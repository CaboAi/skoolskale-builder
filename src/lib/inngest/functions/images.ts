import { generateImages } from "./generate-images";
import { pinImageStyle } from "./pin-image-style";

/**
 * Functions for the /api/inngest-images serve handler (app id
 * skoolskale-builder-images).
 *
 * Deliberately NOT re-exported from ./index.ts. The barrel is imported by
 * /api/inngest and /api/inngest-handover, so listing these there put
 * generate-images — and therefore sharp — in the module graph of all three
 * routes. When sharp's native binary failed to load on Vercel, every one of
 * them 500'd at import time, including the module and handover pipelines
 * that have nothing to do with images.
 *
 * Keeping this entry point separate means a sharp problem can only ever take
 * down image generation, and lets outputFileTracingIncludes target exactly
 * one route.
 */
export const imagesFunctions = [generateImages, pinImageStyle];
