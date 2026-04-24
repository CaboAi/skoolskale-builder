import { and, desc, eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';
import { db } from '@/lib/db';
import type { GeneratorInput, GeneratorModule } from '@/types/generators';
import {
  createJobRow,
  runModule,
  markJobFailed,
  generationJobs,
  type ModuleEventData,
  type ModuleResult,
} from './_shared';

type PromptModule = {
  systemPrompt: string;
  buildUserMessage: (input: GeneratorInput) => string;
  parseOutput: (raw: string) => unknown;
  /** Optional per-module output cap, threaded through to generate(). */
  maxTokens?: number;
};

type FactoryConfig = {
  module: GeneratorModule;
  eventName: string;
  id: string;
  name: string;
  prompt: PromptModule;
};

/**
 * Build an Inngest function that generates one copy module.
 *
 * Each generated function:
 *   - creates a generation_jobs row (status: running)
 *   - loads the creator + pattern library
 *   - calls Claude
 *   - parses + writes generated_assets
 *   - closes the job row
 *
 * On repeated failure, Inngest exhausts its 3 retries then fires the
 * onFailure handler, which marks the job row 'failed' so the VA sees it.
 */
export function createModuleFunction(config: FactoryConfig) {
  return inngest.createFunction(
    {
      id: config.id,
      name: config.name,
      retries: 3,
      triggers: [{ event: config.eventName }],
      onFailure: async ({ event, error }) => {
        // event here is the original + wrapped failure event.
        const data = (event.data as { event?: { data?: ModuleEventData } }).event
          ?.data;
        if (!data?.packageId) return;
        const [row] = await db
          .select({ id: generationJobs.id })
          .from(generationJobs)
          .where(
            and(
              eq(generationJobs.packageId, data.packageId),
              eq(generationJobs.module, config.module),
              eq(generationJobs.status, 'running'),
            ),
          )
          .orderBy(desc(generationJobs.startedAt))
          .limit(1);
        if (row) {
          await markJobFailed(
            row.id,
            (error as Error)?.message ?? 'unknown failure',
          );
        }
      },
    },
    async ({ event, step, runId }): Promise<ModuleResult> => {
      const data = event.data as ModuleEventData;

      const jobId = await step.run('create-job', () =>
        createJobRow({
          packageId: data.packageId,
          module: config.module,
          userId: data.userId,
          inngestRunId: runId,
        }),
      );

      const { assetId } = await step.run('run-module', () =>
        runModule({
          packageId: data.packageId,
          module: config.module,
          jobId,
          userId: data.userId,
          prompt: config.prompt,
          regenerateNote: data.regenerateNote,
        }),
      );

      return { jobId, assetId };
    },
  );
}
