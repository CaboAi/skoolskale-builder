import { desc, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { inngestImages, Events } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { generatedAssets, imageStyleSpecs } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/server";
import { toCreatorContext } from "@/types/generators";
import { serializePackageMarkdown } from "@/lib/modules/serialize";
import { baseStyleSpec } from "@/lib/images/style-spec/base";
import { mergeStyleSpec } from "@/lib/images/style-spec/derive";
import {
  IMAGE_REFERENCES_BUCKET,
  loadImageSource,
  nextStyleSpecVersion,
} from "@/lib/images/plan-source";
import {
  STYLE_SPEC_SYSTEM_PROMPT,
  buildStyleSpecUserMessage,
} from "@/prompts/images/style-spec";
import { generateStyleSpec } from "@/lib/openai/generate-style-spec";

export type PinStyleEventData = {
  packageId: string;
  userId: string;
};

/**
 * Pin the package's art direction.
 *
 * One OpenAI call, one row inserted. Cheap and fast relative to a 12-image
 * run, and deliberately a separate action from generation: the VA looks at
 * the spec, edits it if they disagree, and only then generates. Once pinned,
 * `generate-images` reuses it — that reuse is what keeps a regenerated cover
 * in the same family as its siblings months later.
 */
export const pinImageStyle = inngestImages.createFunction(
  {
    id: "pin-image-style",
    name: "Pin image art direction",
    retries: 2,
    triggers: [{ event: Events.ImagesStyleRequested }],
  },
  async ({ event }) => {
    const data = event.data as PinStyleEventData;

    const source = await loadImageSource(data.packageId);
    if (!source) {
      throw new NonRetriableError(
        `launch_package ${data.packageId} or its creator not found`,
      );
    }

    const creatorContext = toCreatorContext(source.creator);
    const base = baseStyleSpec({
      niche: creatorContext.niche,
      tone: creatorContext.tone,
    });

    // The DNA the copy modules produced is the richest description of this
    // community that exists — the art direction should be derived from it,
    // not from the intake form alone.
    const assetRows = await db
      .select()
      .from(generatedAssets)
      .where(eq(generatedAssets.packageId, data.packageId))
      .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt));
    const dnaMarkdown = serializePackageMarkdown(source.creator, assetRows);

    const brandKit = source.references.find((r) => r.kind === "brand_kit");
    let brandKitImage: { base64: string; mimeType: string } | undefined;
    if (brandKit) {
      const supabase = createServiceClient();
      const { data: blob, error } = await supabase.storage
        .from(IMAGE_REFERENCES_BUCKET)
        .download(brandKit.path);
      if (error || !blob) {
        // Not fatal: a missing brand kit means the palette comes from the
        // niche and the stated preferences instead.
        console.warn(
          `[images/pin-style] brand kit download failed (${brandKit.path}): ${error?.message ?? "no body"}`,
        );
      } else {
        brandKitImage = {
          base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
          mimeType: blob.type || brandKit.mime,
        };
      }
    }

    const { raw, usage } = await generateStyleSpec({
      systemPrompt: STYLE_SPEC_SYSTEM_PROMPT,
      userMessage: buildStyleSpecUserMessage({
        creator: creatorContext,
        dnaMarkdown,
        baseSpec: base,
        hasBrandKitImage: Boolean(brandKitImage),
      }),
      brandKitImage,
    });

    const merged = mergeStyleSpec(base, raw);

    const [row] = await db
      .insert(imageStyleSpecs)
      .values({
        packageId: data.packageId,
        version: await nextStyleSpecVersion(data.packageId),
        spec: merged.spec,
        source: merged.source,
        model: usage.model,
        usage,
        createdBy: data.userId,
      })
      .returning({ id: imageStyleSpecs.id, version: imageStyleSpecs.version });

    await logAudit(
      data.userId,
      "images.style.pin",
      "image_style_spec",
      row.id,
      {
        packageId: data.packageId,
        version: row.version,
        source: merged.source,
        issue: merged.issue,
        costUsd: usage.costUsd,
      },
    );

    return { styleSpecId: row.id, version: row.version, source: merged.source };
  },
);

/** Narrow re-export so callers don't reach into drizzle for this one check. */
export async function styleSpecExists(packageId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: imageStyleSpecs.id })
    .from(imageStyleSpecs)
    .where(eq(imageStyleSpecs.packageId, packageId))
    .limit(1);
  return Boolean(row);
}
