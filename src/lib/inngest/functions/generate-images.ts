import { and, desc, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { inngestImages, Events } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { imageAssets, imageRuns } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { toCreatorContext } from "@/types/generators";
import { uploadStorageObject } from "@/lib/storage/upload";
import { getImageProvider } from "@/lib/image-providers";
import type { ReferenceImageSource } from "@/lib/image-providers/types";
import { fitToTarget } from "@/lib/images/post-process";
import { finalizeImageRun } from "@/lib/images/finalize";
import { buildSlotPrompt } from "@/prompts/images/build-prompt";
import type { ImageStyleSpec } from "@/lib/images/style-spec";
import { findSlot, type SlotPlan } from "@/lib/images/slots";
import {
  IMAGE_REFERENCES_BUCKET,
  IMAGE_SLOTS_BUCKET,
  loadImageSource,
  loadPinnedStyleSpec,
} from "@/lib/images/plan-source";

export type ImagesEventData = {
  packageId: string;
  runId: string;
  userId: string;
  /** Which slots this run covers. A regenerate is a one-entry run. */
  slotKeys: string[];
  regenerateNote?: string;
};

type SlotOutcome = {
  slotKey: string;
  status: "done" | "failed";
  storagePath?: string;
  family?: string;
};

/** Transient-error retries inside one slot, before the step gives up. */
const SLOT_INLINE_RETRIES = 2;

function isTransient(err: unknown): boolean {
  const message = (err as Error)?.message ?? "";
  return (
    message.includes("exceeded") ||
    message.includes("timeout") ||
    /\b(408|429|500|502|503|504)\b/.test(message)
  );
}

async function nextAssetVersion(
  packageId: string,
  slotKey: string,
): Promise<number> {
  const [row] = await db
    .select({ version: imageAssets.version })
    .from(imageAssets)
    .where(
      and(
        eq(imageAssets.packageId, packageId),
        eq(imageAssets.slotKey, slotKey),
      ),
    )
    .orderBy(desc(imageAssets.version))
    .limit(1);
  return (row?.version ?? 0) + 1;
}

/**
 * Generate one slot: prompt, provider call, crop, upload, row.
 *
 * Called INSIDE a step, so all of it retries as one unit and the bytes in
 * storage are always final-spec.
 *
 * Failure policy: a slot that cannot be produced writes a `failed` row and
 * RETURNS normally. It must not throw, because throwing kills the whole run
 * and burns the function's retry budget re-billing the images that already
 * succeeded. Eleven good covers and one bad one is a successful run with one
 * image to redo, and that is how the UI presents it.
 */
async function generateSlot(input: {
  slot: SlotPlan;
  spec: ImageStyleSpec;
  styleSpecId: string | null;
  communityName: string;
  references: ReferenceImageSource[];
  hasPortraitReference: boolean;
  data: ImagesEventData;
}): Promise<SlotOutcome> {
  const { slot, spec, styleSpecId, communityName, data } = input;
  const tag = `[gen/images:${slot.key}]`;

  // Idempotency guard. Step memoization covers the normal replay, but not
  // the window where a row was inserted and the process died before the
  // step returned — this does.
  const [existing] = await db
    .select({
      status: imageAssets.status,
      storagePath: imageAssets.storagePath,
    })
    .from(imageAssets)
    .where(
      and(
        eq(imageAssets.runId, data.runId),
        eq(imageAssets.slotKey, slot.key),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      slotKey: slot.key,
      status: existing.status === "done" ? "done" : "failed",
      storagePath: existing.storagePath ?? undefined,
      family: slot.family,
    };
  }

  const prompt = buildSlotPrompt({
    spec,
    slot,
    communityName,
    regenerateNote: data.regenerateNote,
  });

  const version = await nextAssetVersion(data.packageId, slot.key);
  const storagePath = `${data.packageId}/${slot.kind}/${slot.index}/v${version}.png`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= SLOT_INLINE_RETRIES; attempt++) {
    try {
      const result = await getImageProvider().generate({
        prompt,
        referenceImages: input.references,
        size: slot.sourceSize,
        quality: "high",
        background: slot.background,
        hasPortraitReference: input.hasPortraitReference,
        packageId: data.packageId,
      });

      const fitted = await fitToTarget(result.image, slot.target);
      await uploadStorageObject(
        IMAGE_SLOTS_BUCKET,
        storagePath,
        fitted.buffer,
        "image/png",
      );

      await db.insert(imageAssets).values({
        runId: data.runId,
        packageId: data.packageId,
        slotKey: slot.key,
        slotKind: slot.kind,
        slotIndex: slot.index,
        slotTitle: slot.titleText || null,
        version,
        status: "done",
        storagePath,
        width: fitted.width,
        height: fitted.height,
        mime: "image/png",
        prompt,
        styleSpecId,
        provider: getImageProvider().name,
        model: result.modelUsed,
        costUsd: result.costUsd.toFixed(4),
        durationMs: result.durationMs,
        regenerateNote: data.regenerateNote ?? null,
        createdBy: data.userId,
      });

      return {
        slotKey: slot.key,
        status: "done",
        storagePath,
        family: slot.family,
      };
    } catch (err) {
      lastError = err;
      const retryable = attempt < SLOT_INLINE_RETRIES && isTransient(err);
      console.warn(
        `${tag} attempt ${attempt} failed${retryable ? ", retrying" : ""}:`,
        (err as Error)?.message ?? err,
      );
      if (!retryable) break;
    }
  }

  await db.insert(imageAssets).values({
    runId: data.runId,
    packageId: data.packageId,
    slotKey: slot.key,
    slotKind: slot.kind,
    slotIndex: slot.index,
    slotTitle: slot.titleText || null,
    version,
    status: "failed",
    prompt,
    styleSpecId,
    provider: getImageProvider().name,
    error: ((lastError as Error)?.message ?? "unknown failure").slice(0, 1000),
    regenerateNote: data.regenerateNote ?? null,
    createdBy: data.userId,
  });

  return { slotKey: slot.key, status: "failed", family: slot.family };
}

/**
 * The images pipeline.
 *
 * Strictly one provider call at a time. The serialism is the `await` inside
 * the `for` loop — `concurrency: 1` below is belt-and-braces, and there is
 * deliberately no `Promise.all` anywhere in this file.
 */
export const generateImages = inngestImages.createFunction(
  {
    id: "generate-images",
    name: "Generate community images",
    retries: 2,
    /**
     * Unlike handover (limit 5, sized for its Promise.all fan-out), 1 is
     * correct here: the whole design premise is one image at a time so
     * nothing gets overwhelmed and every image is inspectable in order.
     *
     * Run-level exclusivity is still the POST route's already_running guard,
     * not this setting — Inngest concurrency limits steps in flight.
     */
    concurrency: [{ limit: 1, key: "event.data.packageId" }],
    triggers: [{ event: Events.ImagesGenerateRequested }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: ImagesEventData } }).event
        ?.data;
      if (!data?.runId) return;
      await db
        .update(imageRuns)
        .set({
          status: "failed",
          error: (error?.message ?? "unknown error").slice(0, 1000),
          completedAt: new Date(),
        })
        .where(eq(imageRuns.id, data.runId));
      await logAudit(
        data.userId,
        "images.generate.failed",
        "image_run",
        data.runId,
        { packageId: data.packageId, error: error?.message },
      );
    },
  },
  async ({ event, step, runId: inngestRunId }) => {
    const data = event.data as ImagesEventData;

    await step.run("mark-running", async () => {
      await db
        .update(imageRuns)
        .set({ status: "running", startedAt: new Date(), inngestRunId })
        .where(eq(imageRuns.id, data.runId));
    });

    const source = (await step.run("load-plan", async () => {
      const loaded = await loadImageSource(data.packageId);
      if (!loaded) {
        throw new NonRetriableError(
          `launch_package ${data.packageId} or its creator not found`,
        );
      }
      if (loaded.missingModules.length > 0) {
        throw new NonRetriableError(
          `package not ready for images — unapproved modules: ${loaded.missingModules.join(", ")}`,
        );
      }

      const pinned = await loadPinnedStyleSpec(data.packageId);
      if (!pinned) {
        throw new NonRetriableError(
          "no art direction pinned for this package — pin a style spec before generating",
        );
      }

      const slots = data.slotKeys
        .map((key) => findSlot(loaded.plan, key))
        .filter((s): s is SlotPlan => Boolean(s));
      if (slots.length === 0) {
        throw new NonRetriableError(
          `none of the requested slots exist in the current plan: ${data.slotKeys.join(", ")}`,
        );
      }

      const creatorContext = toCreatorContext(loaded.creator);
      return {
        slots,
        spec: pinned.spec,
        styleSpecId: pinned.id,
        communityName: creatorContext.community_name,
        references: loaded.references.map((r) => ({
          kind: r.kind,
          path: r.path,
        })),
      };
    })) as {
      slots: SlotPlan[];
      spec: ImageStyleSpec;
      styleSpecId: string;
      communityName: string;
      references: { kind: string; path: string }[];
    };

    const headshot = source.references.find((r) => r.kind === "headshot");
    const brandKit = source.references.find((r) => r.kind === "brand_kit");

    /**
     * The style anchor: the first banner this run produces becomes a
     * reference input for every banner after it. gpt-image-1 has no seed, so
     * this is the only real lever on run-to-run visual drift.
     *
     * It is carried in the STEP RETURN VALUE, not a closure variable mutated
     * inside a step. Inngest replays a run by re-reading memoized step
     * results; a mutation performed inside a callback would be lost on
     * replay and the anchor would silently vanish mid-run.
     */
    let anchorPath: string | undefined;

    for (const slot of source.slots) {
      const references: ReferenceImageSource[] = [];
      // Only the slots that can legitimately show a person get the headshot.
      const wantsPortrait =
        source.spec.peoplePolicy === "creator_only" &&
        (slot.kind === "about_us" || slot.kind === "start_here_thumb");
      if (headshot && wantsPortrait) {
        references.push({
          kind: "storage",
          bucket: IMAGE_REFERENCES_BUCKET,
          path: headshot.path,
        });
      }
      if (brandKit) {
        references.push({
          kind: "storage",
          bucket: IMAGE_REFERENCES_BUCKET,
          path: brandKit.path,
        });
      }
      if (anchorPath && slot.family === "banner") {
        references.push({
          kind: "storage",
          bucket: IMAGE_SLOTS_BUCKET,
          path: anchorPath,
        });
      }

      const outcome = (await step.run(`slot-${slot.key}`, () =>
        generateSlot({
          slot,
          spec: source.spec,
          styleSpecId: source.styleSpecId,
          communityName: source.communityName,
          references,
          hasPortraitReference: Boolean(headshot && wantsPortrait),
          data,
        }),
      )) as SlotOutcome;

      if (
        !anchorPath &&
        outcome.status === "done" &&
        outcome.family === "banner" &&
        outcome.storagePath
      ) {
        anchorPath = outcome.storagePath;
      }
    }

    const totals = await step.run("finalize", () =>
      finalizeImageRun({
        runId: data.runId,
        packageId: data.packageId,
        userId: data.userId,
        action: "images.generate.completed",
      }),
    );

    return { runId: data.runId, packageId: data.packageId, usage: totals };
  },
);
