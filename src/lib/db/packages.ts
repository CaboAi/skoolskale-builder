import "server-only";
import { and, eq } from "drizzle-orm";
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
 * Owner-scoped fetch of a launch package + its creator + every generated_asset
 * row tied to it. Returns null when the package doesn't exist OR is owned by
 * a different user — callers should treat both cases as 404 (don't leak
 * existence to non-owners).
 *
 * RLS already enforces ownership; the explicit `createdBy` predicate here is
 * defense-in-depth so a route handler bypassing RLS (service-role client)
 * still gets the right answer.
 */
export async function getPackageWithDetails(
  packageId: string,
  userId: string,
): Promise<PackageWithDetails | null> {
  const [pkg] = await db
    .select()
    .from(launchPackages)
    .where(
      and(
        eq(launchPackages.id, packageId),
        eq(launchPackages.createdBy, userId),
      ),
    )
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
