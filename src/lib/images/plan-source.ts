import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  creators,
  generatedAssets,
  imageReferences,
  imageStyleSpecs,
  launchPackages,
  type Creator,
  type ImageReference,
  type LaunchPackage,
} from "@/lib/db/schema";
import { pickLatestPerModule } from "@/lib/db/packages";
import { getMissingRequiredModules } from "@/lib/modules/registry";
import { planSlots, type SlotPlanResult } from "@/lib/images/slots";
import {
  ImageStyleSpecSchema,
  type ImageStyleSpec,
} from "@/lib/images/style-spec";

/**
 * Everything the images phase needs to read off a package, in one place, so
 * the enqueue route, the poll route, and the Inngest function all agree on
 * what the plan is. Recomputing it in three places is how a slot key ends up
 * meaning two different things.
 */

export const IMAGE_SLOTS_BUCKET = "image-slots";
export const IMAGE_REFERENCES_BUCKET = "image-references";

export type ImageSource = {
  package: LaunchPackage;
  creator: Creator;
  plan: SlotPlanResult;
  /** Latest reference per kind. */
  references: ImageReference[];
  missingModules: string[];
};

type TitledItem = { title?: unknown };

/**
 * Pull titles — and ONLY titles — out of a module asset.
 *
 * This is the boundary the "no descriptions in images" rule is enforced at.
 * Descriptions exist on these rows; they stop here and never enter a
 * SlotPlan, so nothing downstream has to remember to filter them.
 */
function extractTitles(content: unknown, listKey: "items" | "events"): string[] {
  if (typeof content !== "object" || content === null) return [];
  const list = (content as Record<string, unknown>)[listKey];
  if (!Array.isArray(list)) return [];
  return list
    .map((item: TitledItem) =>
      typeof item?.title === "string" ? item.title.trim() : "",
    )
    .filter((title): title is string => title.length > 0);
}

export async function loadImageSource(
  packageId: string,
): Promise<ImageSource | null> {
  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(eq(launchPackages.id, packageId))
    .limit(1);
  if (!pkg) return null;

  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, pkg.creatorId))
    .limit(1);
  if (!creator) return null;

  const assetRows = await db
    .select()
    .from(generatedAssets)
    .where(eq(generatedAssets.packageId, packageId))
    .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt));
  const latest = pickLatestPerModule(assetRows);

  const classroomTitles = extractTitles(
    latest.find((a) => a.module === "classroom")?.content,
    "items",
  );
  const calendarTitles = extractTitles(
    latest.find((a) => a.module === "calendar")?.content,
    "events",
  );

  const referenceRows = await db
    .select()
    .from(imageReferences)
    .where(eq(imageReferences.packageId, packageId))
    .orderBy(desc(imageReferences.createdAt));

  // Latest row per kind wins; replacing a reference inserts rather than
  // updates, so the older rows are history, not candidates.
  const seen = new Set<string>();
  const references = referenceRows.filter((row) => {
    if (seen.has(row.kind)) return false;
    seen.add(row.kind);
    return true;
  });

  return {
    package: pkg,
    creator,
    plan: planSlots({
      communityName: creator.communityName,
      classroomTitles,
      calendarTitles,
    }),
    references,
    missingModules: getMissingRequiredModules(latest),
  };
}

export type PinnedStyleSpec = {
  id: string;
  version: number;
  source: string;
  spec: ImageStyleSpec;
};

/**
 * The pinned art direction, or null if none has been pinned yet.
 *
 * A row that fails validation (schema tightened since it was written) is
 * treated as absent rather than crashing the page — the VA re-pins.
 */
export async function loadPinnedStyleSpec(
  packageId: string,
): Promise<PinnedStyleSpec | null> {
  const [row] = await db
    .select()
    .from(imageStyleSpecs)
    .where(eq(imageStyleSpecs.packageId, packageId))
    .orderBy(desc(imageStyleSpecs.version), desc(imageStyleSpecs.createdAt))
    .limit(1);
  if (!row) return null;

  const parsed = ImageStyleSpecSchema.safeParse(row.spec);
  if (!parsed.success) {
    console.warn(
      `[images] pinned style spec ${row.id} failed validation — treating as unpinned:`,
      parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
    return null;
  }

  return {
    id: row.id,
    version: row.version,
    source: row.source,
    spec: parsed.data,
  };
}

/** Next version for a package's style spec. */
export async function nextStyleSpecVersion(
  packageId: string,
): Promise<number> {
  const [row] = await db
    .select({ version: imageStyleSpecs.version })
    .from(imageStyleSpecs)
    .where(eq(imageStyleSpecs.packageId, packageId))
    .orderBy(desc(imageStyleSpecs.version))
    .limit(1);
  return (row?.version ?? 0) + 1;
}
