import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  creators,
  launchPackages,
  generatedAssets,
  type Creator,
  type LaunchPackage,
  type GeneratedAsset,
} from "@/lib/db/schema";

export type PackageWithDetails = {
  package: LaunchPackage;
  creator: Creator;
  assets: GeneratedAsset[];
};

/**
 * Workspace-wide fetch of a launch package + its creator + every
 * generated_asset row tied to it. Returns null only when the package id
 * doesn't exist (or its creator row is missing — should never happen due
 * to the FK, but defensive).
 *
 * Post chore/remove-image-generation: the signed-URL rewrite that used to
 * wrap image-module variants is gone. All active modules are text — assets
 * are returned as raw DB rows. Legacy image-module rows on old packages
 * are still returned but the dashboard + export view ignore them via the
 * registry filter, so the stale URLs never render.
 *
 * No createdBy filter: every authenticated VA can open every package so
 * handoffs work ("VA closes out, next VA picks up"). RLS on launch_packages
 * is workspace-wide for SELECT post-0006 migration; the Drizzle `db`
 * connects via the service-role DATABASE_URL so RLS is bypassed anyway,
 * and the app-layer was previously the actual access control.
 */
export async function getPackageWithDetails(
  packageId: string,
): Promise<PackageWithDetails | null> {
  return getPackageWithDetailsRaw(packageId);
}

/**
 * Raw DB rows variant — kept as a named export so any out-of-tree caller
 * that imported it before the signed-URL collapse still resolves. Now a
 * trivial alias of the canonical fetcher.
 */
export async function getPackageWithDetailsRaw(
  packageId: string,
): Promise<PackageWithDetails | null> {
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

  // Regeneration inserts a NEW row per module rather than updating in place,
  // so a package can hold several rows for the same module. Order newest-first
  // and keep one row per module — same "latest" definition the PATCH/approve
  // routes use. Without the ordering, Postgres returns rows in physical scan
  // order and the dashboard's `new Map(assets.map(...))` last-wins lookup can
  // land on a stale row, leaving the card stuck on its regenerating skeleton.
  const assetRows = await db
    .select()
    .from(generatedAssets)
    .where(eq(generatedAssets.packageId, pkg.id))
    .orderBy(desc(generatedAssets.version), desc(generatedAssets.createdAt));

  return { package: pkg, creator, assets: pickLatestPerModule(assetRows) };
}

/**
 * Collapse rows already ordered newest-first to one row per module.
 * Exported for unit tests — the DB ordering is what makes "first wins"
 * mean "latest wins".
 */
export function pickLatestPerModule(
  rows: GeneratedAsset[],
): GeneratedAsset[] {
  const latest = new Map<string, GeneratedAsset>();
  for (const row of rows) {
    if (!latest.has(row.module)) latest.set(row.module, row);
  }
  return [...latest.values()];
}

export type PackageListItem = {
  id: string;
  communityName: string;
};

/**
 * Workspace-wide list of every launch package, ordered by createdAt DESC
 * (most-recent first). One row per package; the community name comes from
 * the joined creators row. Used by the home-page library view.
 */
export async function getAllPackagesForListing(): Promise<PackageListItem[]> {
  const rows = await db
    .select({
      id: launchPackages.id,
      communityName: creators.communityName,
    })
    .from(launchPackages)
    .innerJoin(creators, eq(launchPackages.creatorId, creators.id))
    .orderBy(desc(launchPackages.createdAt));
  return rows;
}
