"use client";

import type { Creator, LaunchPackage, GeneratedAsset } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PackageDashboardProps = {
  package: LaunchPackage;
  creator: Creator;
  assets: GeneratedAsset[];
};

/**
 * Stub. Sprint 5.2 fleshes this out into the full review grid (header,
 * status badge, 5 module cards, action buttons). 5.1 just confirms the
 * page → API → DB plumbing works end-to-end.
 */
export function PackageDashboard({
  package: pkg,
  creator,
  assets,
}: PackageDashboardProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{creator.communityName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Creator: {creator.name}</p>
          <p>Status: {pkg.status}</p>
          <p>Assets generated: {assets.length} / 5</p>
        </CardContent>
      </Card>
    </div>
  );
}
