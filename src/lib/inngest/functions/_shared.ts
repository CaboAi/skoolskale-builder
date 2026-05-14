import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  creators,
  launchPackages,
  generationJobs,
  generatedAssets,
} from '@/lib/db/schema';
import type { GeneratorModule as ModuleName, GeneratorInput } from '@/types/generators';
import { toCreatorContext } from '@/types/generators';
import { fetchPatternExamples } from '@/lib/generators/pattern-library';
import { generate } from '@/lib/claude/generate';

/**
 * Shared helpers used by every per-module Inngest generation function.
 *
 * Each function is responsible for:
 *   1. creating a generation_jobs row (status: running)
 *   2. loading creator + pattern examples
 *   3. calling Claude
 *   4. parsing output (caller supplies parseOutput)
 *   5. writing generated_assets + closing the job row
 */

type Prompt = {
  systemPrompt: string;
  buildUserMessage: (input: GeneratorInput) => string;
  /**
   * Parsers receive the optional GeneratorInput so they can stitch parsed
   * fields together with intake-side data (e.g., calendar pairs each parsed
   * description with the schedule the VA supplied in the wizard).
   */
  parseOutput: (raw: string, input?: GeneratorInput) => unknown;
  /** Optional per-module output cap. Unset → generate() uses its default. */
  maxTokens?: number;
};

export type ModuleEventData = {
  packageId: string;
  userId: string;
  regenerateNote?: string;
  /**
   * Phase 2 prompt editor: when set, the function uses this string
   * verbatim as the prompt and skips the builder + pattern-library
   * load. regenerateNote is ignored in this path — if the VA wanted
   * a note suffix they can include it in the edited prompt directly.
   */
  editedPrompt?: string;
};

export type ModuleResult = {
  jobId: string;
  assetId: string;
};

export async function createJobRow(params: {
  packageId: string;
  module: ModuleName;
  userId: string;
  inngestRunId: string;
}) {
  console.log(`[gen/${params.module}] createJobRow packageId=${params.packageId}`);
  try {
    const [row] = await db
      .insert(generationJobs)
      .values({
        packageId: params.packageId,
        module: params.module,
        status: 'running',
        inngestRunId: params.inngestRunId,
        createdBy: params.userId,
        startedAt: new Date(),
      })
      .returning({ id: generationJobs.id });
    console.log(`[gen/${params.module}] job row id=${row.id}`);
    return row.id;
  } catch (e) {
    console.error(`[gen/${params.module}] createJobRow FAILED`, e);
    throw e;
  }
}

export async function loadCreatorForPackage(params: {
  packageId: string;
  /**
   * Retained for caller-side audit logging context, but not used to scope
   * the query — packages are workspace-wide so any VA's generation can
   * touch any package (e.g. handoff regeneration).
   */
  userId: string;
}) {
  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(eq(launchPackages.id, params.packageId))
    .limit(1);
  if (!pkg) throw new Error(`launch_package ${params.packageId} not found`);

  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, pkg.creatorId))
    .limit(1);
  if (!creator) throw new Error(`creator ${pkg.creatorId} not found`);
  return creator;
}

export async function runModule<T>(params: {
  packageId: string;
  module: ModuleName;
  jobId: string;
  userId: string;
  prompt: Prompt;
  regenerateNote?: string;
  editedPrompt?: string;
}): Promise<{ parsed: T; assetId: string }> {
  const tag = `[gen/${params.module}]`;
  try {
    let userMessage: string;
    let input: GeneratorInput | undefined;
    if (params.editedPrompt) {
      // Edited-prompt path: skip creator/pattern lookup entirely. The VA
      // owns the prompt; we just pass it through the same generate() +
      // parse + persist pipeline.
      console.log(
        `${tag} editedPrompt path (length=${params.editedPrompt.length}); skipping builder`,
      );
      userMessage = params.editedPrompt;
    } else {
      console.log(`${tag} loadCreatorForPackage`);
      const creator = await loadCreatorForPackage({
        packageId: params.packageId,
        userId: params.userId,
      });

      console.log(
        `${tag} fetchPatternExamples niche=${creator.niche} tone=${creator.tone}`,
      );
      const patterns = await fetchPatternExamples({
        module: params.module,
        niche: creator.niche,
        tone: creator.tone,
      });
      console.log(`${tag} patterns.length=${patterns.length}`);

      input = {
        creator: toCreatorContext(creator),
        patternLibrary: patterns,
        regenerateNote: params.regenerateNote,
      };

      userMessage = params.prompt.buildUserMessage(input);
    }
    console.log(`${tag} calling Claude (userMessage.length=${userMessage.length})`);
    const { text, inputTokens, outputTokens, durationMs } = await generate({
      systemPrompt: params.prompt.systemPrompt,
      userMessage,
      jobId: params.jobId,
      maxTokens: params.prompt.maxTokens,
    });
    console.log(`${tag} Claude done in=${inputTokens} out=${outputTokens} ms=${durationMs}`);

    const parsed = params.prompt.parseOutput(text, input) as T;
    console.log(`${tag} parsed OK; inserting asset`);

    const [asset] = await db
      .insert(generatedAssets)
      .values({
        packageId: params.packageId,
        module: params.module,
        version: 1,
        content: parsed as object,
        approved: false,
        editHistory: [],
        createdBy: params.userId,
      })
      .returning({ id: generatedAssets.id });
    console.log(`${tag} asset inserted id=${asset.id}`);

    await db
      .update(generationJobs)
      .set({ status: 'done', completedAt: new Date() })
      .where(eq(generationJobs.id, params.jobId));

    return { parsed, assetId: asset.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${tag} runModule FAILED: ${msg}`);
    if (e instanceof Error && e.stack) console.error(e.stack);
    throw e;
  }
}

export async function markJobFailed(jobId: string, message: string) {
  await db
    .update(generationJobs)
    .set({
      status: 'failed',
      error: message.slice(0, 1000),
      completedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
}

// Re-export the runtime Drizzle references so consumers can import one file.
export { creators, launchPackages, generationJobs, generatedAssets };
