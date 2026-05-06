export { generateWelcomeDm } from "./generate-welcome-dm";
export { generateTransformation } from "./generate-transformation";
export { generateAboutUs } from "./generate-about-us";
export { generateStartHere } from "./generate-start-here";
export { generateCover } from "./generate-cover";
export { generateClassroom } from "./generate-classroom";
export { generateCalendar } from "./generate-calendar";
export { generateLeaderboard } from "./generate-leaderboard";
export { generateCategories } from "./generate-categories";
export { generateDiscoverySeo } from "./generate-discovery-seo";
export { generatePackage } from "./generate-package";

import { generateWelcomeDm } from "./generate-welcome-dm";
import { generateTransformation } from "./generate-transformation";
import { generateAboutUs } from "./generate-about-us";
import { generateStartHere } from "./generate-start-here";
import { generateCover } from "./generate-cover";
import { generateClassroom } from "./generate-classroom";
import { generateCalendar } from "./generate-calendar";
import { generateLeaderboard } from "./generate-leaderboard";
import { generateCategories } from "./generate-categories";
import { generateDiscoverySeo } from "./generate-discovery-seo";
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
  generateClassroom,
  generateCalendar,
  generateLeaderboard,
  generateCategories,
  generateDiscoverySeo,
  generatePackage,
];
