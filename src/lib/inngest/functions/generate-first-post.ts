import { and, desc, eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';
import { db } from '@/lib/db';
import { generatedAssets, generationJobs } from '@/lib/db/schema';
import { toCreatorContext } from '@/types/generators';
import type { GeneratorInput } from '@/types/generators';
import { fetchPatternExamples } from '@/lib/generators/pattern-library';
import { generate } from '@/lib/claude/generate';
import {
  CapViolationError,
  buildCapRetryInstruction,
} from '@/lib/inngest/cap-violation';
import { resolveIntroCategory } from '@/lib/inngest/resolve-intro-category';
import {
  systemPrompt,
  buildUserMessage,
  parseOutput,
  type FirstPostOutput,
} from '@/prompts/first-post';
import {
  createJobRow,
  loadCreatorForPackage,
  markJobFailed,
  type ModuleEventData,
  type ModuleResult,
} from './_shared';

/**
 * First-post generator — bespoke because of the cross-module dependency
 * on the `categories` asset. The shared `_factory.createModuleFunction`
 * helper assumes `buildUserMessage(input)` is a pure function of the
 * creator + pattern library; here we need an extra resolved field
 * (intro category name) that comes from another module's output. The
 * factory's interface is intentionally kept narrow — bespoke is the
 * right escape hatch for this one-off pattern.
 *
 * Cap-violation retry semantics match the factory path (one rewrite-
 * tighter retry, then propagate).
 */
export const generateFirstPost = inngest.createFunction(
  {
    id: 'generate-first-post',
    name: 'Generate First Post',
    retries: 3,
    triggers: [{ event: 'generate.first_post.requested' }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: ModuleEventData } }).event
        ?.data;
      if (!data?.packageId) return;
      const [row] = await db
        .select({ id: generationJobs.id })
        .from(generationJobs)
        .where(
          and(
            eq(generationJobs.packageId, data.packageId),
            eq(generationJobs.module, 'first_post'),
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
        module: 'first_post',
        userId: data.userId,
        inngestRunId: runId,
      }),
    );

    const result = await step.run('run-first-post', async () => {
      const tag = '[gen/first_post]';

      let userMessage: string;
      let input: GeneratorInput | undefined;

      if (data.editedPrompt) {
        // Edited-prompt path: skip creator + categories lookup. The
        // VA owns the prompt; we pass it through unchanged.
        console.log(
          `${tag} editedPrompt path (length=${data.editedPrompt.length}); skipping builder + intro-category resolver`,
        );
        userMessage = data.editedPrompt;
      } else {
        const creator = await loadCreatorForPackage({
          packageId: data.packageId,
          userId: data.userId,
        });

        const patterns = await fetchPatternExamples({
          module: 'first_post',
          niche: creator.niche,
          tone: creator.tone,
        });

        const creatorContext = toCreatorContext(creator);
        input = {
          creator: creatorContext,
          patternLibrary: patterns,
          regenerateNote: data.regenerateNote,
        };

        // Read-from-intake conditional (synchronously available, no
        // polling needed). Distinct from the categories cross-module
        // dep below.
        const hasCalendarEvents =
          (creatorContext.calendar_intake?.events?.length ?? 0) > 0;

        // Cross-module dependency. Polls the generated categories
        // asset with backoff; falls back to a Skool default if absent
        // or non-matching. See resolve-intro-category.ts for the
        // detailed fallback ladder.
        console.log(`${tag} resolving intro category…`);
        const introCategoryName = await resolveIntroCategory(data.packageId);
        console.log(`${tag} intro category = "${introCategoryName}"`);

        userMessage = buildUserMessage({
          input,
          introCategoryName,
          hasCalendarEvents,
        });
      }

      // Generate + parse with one cap-violation retry (same machinery
      // as the shared runner). Body-over-cap throws CapViolationError;
      // anything else propagates and lands in Inngest's standard retry.
      let parsed: FirstPostOutput | null = null;
      let attempt = 1;
      const MAX_ATTEMPTS = 2;
      let currentMessage = userMessage;
      while (attempt <= MAX_ATTEMPTS) {
        const { text } = await generate({
          systemPrompt,
          userMessage: currentMessage,
          jobId,
        });
        try {
          parsed = parseOutput(text);
          break;
        } catch (e) {
          if (e instanceof CapViolationError && attempt < MAX_ATTEMPTS) {
            console.warn(
              `${tag} body cap violation ${e.actualChars}/${e.maxChars}; retrying once`,
            );
            currentMessage =
              userMessage +
              buildCapRetryInstruction({
                actualChars: e.actualChars,
                maxChars: e.maxChars,
                rawOutput: e.rawOutput,
              });
            attempt += 1;
            continue;
          }
          throw e;
        }
      }
      if (!parsed) {
        throw new Error('first_post: no output produced after retries');
      }

      const [asset] = await db
        .insert(generatedAssets)
        .values({
          packageId: data.packageId,
          module: 'first_post',
          version: 1,
          content: parsed,
          approved: false,
          editHistory: [],
          createdBy: data.userId,
        })
        .returning({ id: generatedAssets.id });

      await db
        .update(generationJobs)
        .set({ status: 'done', completedAt: new Date() })
        .where(eq(generationJobs.id, jobId));

      return { assetId: asset.id };
    });

    return { jobId, assetId: result.assetId };
  },
);
