export { generateWelcomeDm } from "./generate-welcome-dm";
export { generateTransformation } from "./generate-transformation";
export { generateAboutUs } from "./generate-about-us";
export { generateStartHere } from "./generate-start-here";
export { generateFirstPost } from "./generate-first-post";
export { generateClassroom } from "./generate-classroom";
export { generateCalendar } from "./generate-calendar";
export { generateLeaderboard } from "./generate-leaderboard";
export { generateCategories } from "./generate-categories";
export { generateDiscoverySeo } from "./generate-discovery-seo";
export { generatePackage } from "./generate-package";
export { generateHandover } from "./generate-handover";
export { renderHandoverPdfs } from "./render-handover-pdfs";

import { generateWelcomeDm } from "./generate-welcome-dm";
import { generateTransformation } from "./generate-transformation";
import { generateAboutUs } from "./generate-about-us";
import { generateStartHere } from "./generate-start-here";
import { generateFirstPost } from "./generate-first-post";
import { generateClassroom } from "./generate-classroom";
import { generateCalendar } from "./generate-calendar";
import { generateLeaderboard } from "./generate-leaderboard";
import { generateCategories } from "./generate-categories";
import { generateDiscoverySeo } from "./generate-discovery-seo";
import { generatePackage } from "./generate-package";
import { generateHandover } from "./generate-handover";
import { renderHandoverPdfs } from "./render-handover-pdfs";

/**
 * Registered functions for the Inngest serve handler at /api/inngest.
 * Add new functions to this list when they're created.
 *
 * generateHandover is NOT here — it belongs to the separate
 * skoolskale-builder-handover app served at /api/inngest-handover (see
 * handoverFunctions below), which carries a higher maxDuration for the
 * long Opus steps.
 *
 * Image generators (generate-cover / generate-icon / generate-classroom-cover
 * / generate-calendar-cover) were removed in the chore/remove-image-generation
 * cut — VAs handle community visuals externally now.
 */
export const functions = [
  generateWelcomeDm,
  generateTransformation,
  generateAboutUs,
  generateStartHere,
  generateFirstPost,
  generateClassroom,
  generateCalendar,
  generateLeaderboard,
  generateCategories,
  generateDiscoverySeo,
  generatePackage,
];

/** Functions for the /api/inngest-handover serve handler. */
export const handoverFunctions = [generateHandover, renderHandoverPdfs];
