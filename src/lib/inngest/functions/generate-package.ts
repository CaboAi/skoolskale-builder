import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';
import { db } from '@/lib/db';
import { launchPackages } from '@/lib/db/schema';
import { generateWelcomeDm } from './generate-welcome-dm';
import { generateTransformation } from './generate-transformation';
import { generateAboutUs } from './generate-about-us';
import { generateStartHere } from './generate-start-here';

type PackageEventData = {
  packageId: string;
  userId: string;
};

/**
 * Orchestrator: fans out the 4 copy module generations in parallel using
 * step.invoke. Each sub-function owns its own retry policy and failure
 * accounting; the orchestrator just cares whether they all completed.
 *
 * On completion the launch_packages row is bumped to status='review'.
 * If any sub-invocation fails terminally, status goes to 'draft' (VA can
 * re-queue from the dashboard) and the per-job failure is already recorded.
 */
export const generatePackage = inngest.createFunction(
  {
    id: 'generate-package',
    name: 'Generate launch package (fan-out)',
    retries: 1, // sub-functions own the retry budget; orchestrator just coordinates
    triggers: [{ event: 'package.generate.requested' }],
    onFailure: async ({ event }) => {
      const data = (event.data as { event?: { data?: PackageEventData } }).event
        ?.data;
      if (!data?.packageId) return;
      await db
        .update(launchPackages)
        .set({ status: 'draft' })
        .where(eq(launchPackages.id, data.packageId));
    },
  },
  async ({ event, step }) => {
    const data = event.data as PackageEventData;

    // Fan-out via step.invoke — runs the 4 sub-functions in parallel.
    const [welcome, transformation, aboutUs, startHere] = await Promise.all([
      step.invoke('welcome-dm', {
        function: generateWelcomeDm,
        data: { packageId: data.packageId, userId: data.userId },
      }),
      step.invoke('transformation', {
        function: generateTransformation,
        data: { packageId: data.packageId, userId: data.userId },
      }),
      step.invoke('about-us', {
        function: generateAboutUs,
        data: { packageId: data.packageId, userId: data.userId },
      }),
      step.invoke('start-here', {
        function: generateStartHere,
        data: { packageId: data.packageId, userId: data.userId },
      }),
    ]);

    await step.run('mark-package-ready', async () => {
      await db
        .update(launchPackages)
        .set({ status: 'review', progressPct: 100 })
        .where(eq(launchPackages.id, data.packageId));
    });

    return {
      packageId: data.packageId,
      welcome,
      transformation,
      aboutUs,
      startHere,
    };
  },
);
