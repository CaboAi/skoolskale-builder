export { generateWelcomeDm } from "./generate-welcome-dm";
export { generateTransformation } from "./generate-transformation";
export { generateAboutUs } from "./generate-about-us";
export { generateStartHere } from "./generate-start-here";
export { generateCover } from "./generate-cover";
export { generatePackage } from "./generate-package";

import { generateWelcomeDm } from "./generate-welcome-dm";
import { generateTransformation } from "./generate-transformation";
import { generateAboutUs } from "./generate-about-us";
import { generateStartHere } from "./generate-start-here";
import { generateCover } from "./generate-cover";
import { generatePackage } from "./generate-package";

/**
 * Registered functions for the Inngest serve handler at /api/inngest.
 * Add new functions to this list when they're created.
 */
export const functions = [
  generateWelcomeDm,
  generateTransformation,
  generateAboutUs,
  generateStartHere,
  generateCover,
  generatePackage,
];
