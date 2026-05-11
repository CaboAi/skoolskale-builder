import "server-only";
/**
 * Server-side dispatch for the "show prompt" + "regenerate with edited
 * prompt" features (PR #14, Phase 2).
 *
 * Why this lives here and not in `@/lib/modules/registry`:
 *   - registry is a *client-safe* module (the dashboard imports it).
 *     Importing the prompt builders is fine on the client BUT we also
 *     need to load pattern library examples + creator rows from the DB
 *     to construct the actual prompt string the model will see — and
 *     those imports must stay server-only.
 *
 * What this module does:
 *   - Map every ModuleKey to the prompt builder it uses.
 *   - Produce the user message (text modules) or natural-language prompt
 *     (image modules) that the Inngest function would build, given the
 *     current creator + an optional regenerate note.
 *
 * What this module does NOT do:
 *   - Call the model. That's the Inngest function's job.
 *   - Persist anything. Read-only against creator + pattern_library.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creators, launchPackages } from "@/lib/db/schema";
import { fetchPatternExamples } from "@/lib/generators/pattern-library";
import { toCreatorContext } from "@/types/generators";
import type { GeneratorInput } from "@/types/generators";
import type { ModuleKey } from "@/lib/modules/registry";

import { buildUserMessage as buildAboutUs } from "@/prompts/about-us";
import { buildUserMessage as buildCalendar } from "@/prompts/calendar";
import { buildUserMessage as buildCategories } from "@/prompts/categories";
import { buildUserMessage as buildClassroom } from "@/prompts/classroom";
import { buildUserMessage as buildDiscoverySeo } from "@/prompts/discovery_seo";
import { buildUserMessage as buildLeaderboard } from "@/prompts/leaderboard";
import { buildUserMessage as buildStartHere } from "@/prompts/start-here";
import { buildUserMessage as buildTransformation } from "@/prompts/transformation";
import { buildUserMessage as buildWelcomeDm } from "@/prompts/welcome-dm";

import { buildImagePrompt as buildCover } from "@/prompts/cover";
import { buildIconPrompt, ICON_STYLES } from "@/prompts/icon";
import { buildClassroomCoverPrompt } from "@/prompts/classroom_cover";
import { buildCalendarCoverPrompt } from "@/prompts/calendar_cover";

type TextBuilder = (input: GeneratorInput) => string;

const TEXT_BUILDERS: Record<string, TextBuilder> = {
  welcome_dm: buildWelcomeDm,
  transformation: buildTransformation,
  about_us: buildAboutUs,
  start_here: buildStartHere,
  classroom: buildClassroom,
  calendar: buildCalendar,
  leaderboard: buildLeaderboard,
  categories: buildCategories,
  discovery_seo: buildDiscoverySeo,
};

/**
 * Resolve the constructed prompt for one module.
 *
 * - Verifies the package belongs to the user (caller is expected to have
 *   already checked auth; this is the same row-scope check the Inngest
 *   function uses, kept here so the endpoint can short-circuit cleanly).
 * - Returns the EXACT string the Inngest function would send to the
 *   model, including the regenerate-note suffix when `regenerateNote`
 *   is provided. The icon module returns the first style's prompt as a
 *   single representative — the editedPrompt path uses the same string
 *   for all 3 variants, so showing one is faithful.
 */
export async function buildPromptFor(args: {
  packageId: string;
  userId: string;
  module: ModuleKey;
  regenerateNote?: string;
}): Promise<string> {
  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(
      and(
        eq(launchPackages.id, args.packageId),
        eq(launchPackages.createdBy, args.userId),
      ),
    )
    .limit(1);
  if (!pkg) throw new Error(`launch_package ${args.packageId} not found`);

  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, pkg.creatorId))
    .limit(1);
  if (!creator) throw new Error(`creator ${pkg.creatorId} not found`);

  const creatorContext = toCreatorContext(creator);

  // Image modules — no pattern library lookup.
  if (args.module === "cover") {
    return buildCover({
      creator: creatorContext,
      transformationLine: creatorContext.transformation,
      regenerateNote: args.regenerateNote,
    });
  }
  if (args.module === "icon") {
    return buildIconPrompt({
      creator: creatorContext,
      style: ICON_STYLES[0],
      regenerateNote: args.regenerateNote,
    });
  }
  if (args.module === "classroom_cover") {
    return buildClassroomCoverPrompt({
      creator: creatorContext,
      regenerateNote: args.regenerateNote,
    });
  }
  if (args.module === "calendar_cover") {
    return buildCalendarCoverPrompt({
      creator: creatorContext,
      regenerateNote: args.regenerateNote,
    });
  }

  // Text modules — fetch pattern library, then build via the right builder.
  const builder = TEXT_BUILDERS[args.module];
  if (!builder) {
    throw new Error(`No prompt builder registered for module '${args.module}'`);
  }
  const patternLibrary = await fetchPatternExamples({
    module: args.module,
    niche: creator.niche,
    tone: creator.tone,
  });
  return builder({
    creator: creatorContext,
    patternLibrary,
    regenerateNote: args.regenerateNote,
  });
}
