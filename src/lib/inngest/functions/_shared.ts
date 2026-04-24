import 'server-only';
import { and, eq } from 'drizzle-orm';
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
  parseOutput: (raw: string) => unknown;
};

export type ModuleEventData = {
  packageId: string;
  userId: string;
  regenerateNote?: string;
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
  return row.id;
}

export async function loadCreatorForPackage(params: {
  packageId: string;
  userId: string;
}) {
  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(
      and(
        eq(launchPackages.id, params.packageId),
        eq(launchPackages.createdBy, params.userId),
      ),
    )
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
}): Promise<{ parsed: T; assetId: string }> {
  const creator = await loadCreatorForPackage({
    packageId: params.packageId,
    userId: params.userId,
  });

  const patterns = await fetchPatternExamples({
    module: params.module,
    niche: creator.niche,
    tone: creator.tone,
  });

  const input: GeneratorInput = {
    creator: toCreatorContext(creator),
    patternLibrary: patterns,
    regenerateNote: params.regenerateNote,
  };

  const userMessage = params.prompt.buildUserMessage(input);
  const { text } = await generate({
    systemPrompt: params.prompt.systemPrompt,
    userMessage,
    jobId: params.jobId,
  });

  const parsed = params.prompt.parseOutput(text) as T;

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

  await db
    .update(generationJobs)
    .set({ status: 'done', completedAt: new Date() })
    .where(eq(generationJobs.id, params.jobId));

  return { parsed, assetId: asset.id };
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
