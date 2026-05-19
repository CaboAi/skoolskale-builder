import { eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { launchPackages } from "@/lib/db/schema";
import { MODULE_REGISTRY, type ModuleKey } from "@/lib/modules/registry";
import { generateWelcomeDm } from "./generate-welcome-dm";
import { generateTransformation } from "./generate-transformation";
import { generateAboutUs } from "./generate-about-us";
import { generateStartHere } from "./generate-start-here";
import { generateClassroom } from "./generate-classroom";
import { generateCalendar } from "./generate-calendar";
import { generateLeaderboard } from "./generate-leaderboard";
import { generateCategories } from "./generate-categories";
import { generateDiscoverySeo } from "./generate-discovery-seo";

type PackageEventData = {
  packageId: string;
  userId: string;
};

/**
 * Module key → Inngest sub-function. Lives here (not in the registry) so
 * `registry.ts` stays free of `server-only` imports and can be bundled into
 * the client.
 *
 * `Partial<Record<...>>` because not every registered module has a generator
 * yet — add-on modules (PR #4) are registered with `includedByDefault: false`
 * and get their generators in PR #5. The fan-out below filters by both
 * `includedByDefault` and the presence of an entry here, so a module that's
 * default-on but missing a function fails fast at startup rather than mid-run.
 */
const FUNCTIONS: Partial<
  Record<
    ModuleKey,
    | typeof generateWelcomeDm
    | typeof generateTransformation
    | typeof generateAboutUs
    | typeof generateStartHere
    | typeof generateClassroom
    | typeof generateCalendar
    | typeof generateLeaderboard
    | typeof generateCategories
    | typeof generateDiscoverySeo
  >
> = {
  welcome_dm: generateWelcomeDm,
  transformation: generateTransformation,
  about_us: generateAboutUs,
  start_here: generateStartHere,
  classroom: generateClassroom,
  calendar: generateCalendar,
  leaderboard: generateLeaderboard,
  categories: generateCategories,
  discovery_seo: generateDiscoverySeo,
};

/**
 * Orchestrator: fans out every `includedByDefault` module generation in
 * parallel using step.invoke. Each sub-function owns its own retry policy
 * and failure accounting; the orchestrator just cares whether they all
 * completed.
 *
 * On completion the launch_packages row is bumped to status='review'.
 * If any sub-invocation fails terminally, status goes to 'draft' (VA can
 * re-queue from the dashboard) and the per-job failure is already recorded.
 */
export const generatePackage = inngest.createFunction(
  {
    id: "generate-package",
    name: "Generate launch package (fan-out)",
    retries: 1, // sub-functions own the retry budget; orchestrator just coordinates
    triggers: [{ event: "package.generate.requested" }],
    onFailure: async ({ event }) => {
      const data = (event.data as { event?: { data?: PackageEventData } }).event
        ?.data;
      if (!data?.packageId) return;
      await db
        .update(launchPackages)
        .set({ status: "draft" })
        .where(eq(launchPackages.id, data.packageId));
    },
  },
  async ({ event, step }) => {
    const data = event.data as PackageEventData;

    // Fan-out via step.invoke — every default-on module runs in parallel.
    // Step IDs use kebab-case (welcome-dm, about-us, etc.) to preserve
    // existing Inngest run history; the registry uses snake_case keys.
    const modulesToRun = Object.values(MODULE_REGISTRY).filter(
      (m) => m.includedByDefault,
    );
    const results = await Promise.all(
      modulesToRun.map((m) => {
        const fn = FUNCTIONS[m.key];
        if (!fn) {
          // includedByDefault: true with no FUNCTIONS entry is a deploy bug.
          // Fail loudly so the orchestrator's onFailure flips status='draft'
          // and the VA can retry once the function is registered.
          throw new Error(`No Inngest function registered for module ${m.key}`);
        }
        return step.invoke(m.key.replace(/_/g, "-"), {
          function: fn,
          data: { packageId: data.packageId, userId: data.userId },
        });
      }),
    );
    const byKey = Object.fromEntries(
      modulesToRun.map((m, i) => [m.key, results[i]]),
    ) as Record<ModuleKey, (typeof results)[number]>;

    await step.run("mark-package-ready", async () => {
      await db
        .update(launchPackages)
        .set({ status: "review", progressPct: 100 })
        .where(eq(launchPackages.id, data.packageId));
    });

    return {
      packageId: data.packageId,
      welcome: byKey.welcome_dm,
      transformation: byKey.transformation,
      aboutUs: byKey.about_us,
      startHere: byKey.start_here,
    };
  },
);
