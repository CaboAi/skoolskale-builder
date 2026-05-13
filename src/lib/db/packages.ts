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
import { resolveAssetUrls } from "@/lib/storage/resolve-variants";

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
 * Image-module variant `url` fields are REWRITTEN in the returned data to
 * fresh signed URLs (Supabase Storage `/object/sign/...?token=...`) with
 * TTL = IMAGE_RENDER_TTL_SECONDS (1h). Callers can pass `variants[].url`
 * straight to `<Image>` or any HTTP-fetching client. Treat the field as
 * ephemeral — DO NOT persist it back to the DB (that would round-trip a
 * signed URL with a token into storage and corrupt the row). For write
 * paths that need to preserve `storagePath`, use `getPackageWithDetailsRaw`.
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
  const raw = await getPackageWithDetailsRaw(packageId);
  if (!raw) return null;
  const assets = await resolveAssetUrls(raw.assets);
  return { ...raw, assets };
}

/**
 * Same as `getPackageWithDetails` but returns the raw DB rows — image-module
 * variants keep their stored `storagePath` and any legacy public `url`
 * untouched. Use this from write paths (PATCH/PUT routes, the download
 * route) where the caller must read `storagePath` directly.
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

  const assets = await db
    .select()
    .from(generatedAssets)
    .where(eq(generatedAssets.packageId, pkg.id));

  return { package: pkg, creator, assets };
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
