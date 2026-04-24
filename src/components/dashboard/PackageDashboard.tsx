"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Creator, GeneratedAsset, LaunchPackage } from "@/lib/db/schema";
import {
  AboutUsCard,
  COPY_MODULES,
  CopyModuleSkeleton,
  CoverCard,
  CoverSkeleton,
  StartHereCard,
  TransformationCard,
  WelcomeDmCard,
  type ModuleAction,
  type ModuleActionHandler,
} from "./module-cards";

export type PackageDashboardProps = {
  package: LaunchPackage;
  creator: Creator;
  assets: GeneratedAsset[];
};

type PackageWithDetails = {
  package: LaunchPackage;
  creator: Creator;
  assets: GeneratedAsset[];
};

/* -------------------------------------------------------------------------- */
/* Status badge                                                                */
/* -------------------------------------------------------------------------- */

const STATUS_STYLES: Record<LaunchPackage["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  generating: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ready: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  deployed: "bg-emerald-600 text-white",
  archived: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: LaunchPackage["status"] }) {
  return (
    <Badge
      variant="secondary"
      className={cn("uppercase", STATUS_STYLES[status])}
    >
      {status}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* PackageDashboard                                                            */
/* -------------------------------------------------------------------------- */

export function PackageDashboard(initial: PackageDashboardProps) {
  // Server hands us the data; TanStack Query takes over so we can poll.
  const { data } = useQuery<PackageWithDetails>({
    queryKey: ["package", initial.package.id],
    queryFn: async () => {
      const res = await fetch(`/api/packages/${initial.package.id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load package (${res.status})`);
      return (await res.json()) as PackageWithDetails;
    },
    initialData: {
      package: initial.package,
      creator: initial.creator,
      assets: initial.assets,
    },
    refetchInterval: (q) =>
      q.state.data?.package.status === "generating" ? 5_000 : false,
  });

  const { package: pkg, creator, assets } = data;
  const byModule = new Map(assets.map((a) => [a.module, a]));
  const approvedCount = assets.filter((a) => a.approved).length;

  const handleAction: ModuleActionHandler = (module, action: ModuleAction) => {
    // Real handlers land in 5.3.
    console.log({ module, action, packageId: pkg.id });
  };
  const handleSelectVariant = (index: number) => {
    console.log({
      module: "cover",
      action: "select_variant",
      index,
      packageId: pkg.id,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {creator.name}
          </h1>
          <p className="text-muted-foreground">{creator.communityName}</p>
          <p className="text-sm text-muted-foreground">
            {approvedCount} of 5 modules approved
          </p>
        </div>
        <StatusBadge status={pkg.status} />
      </header>

      {/* Module grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Cover spans both columns */}
        {byModule.has("cover") ? (
          <CoverCard
            asset={byModule.get("cover")!}
            onAction={handleAction}
            onSelectVariant={handleSelectVariant}
          />
        ) : (
          <CoverSkeleton />
        )}

        {/* Copy modules */}
        {COPY_MODULES.map((module) => {
          const asset = byModule.get(module);
          if (!asset) {
            return <CopyModuleSkeleton key={module} module={module} />;
          }
          if (module === "welcome_dm") {
            return (
              <WelcomeDmCard
                key={module}
                asset={asset}
                onAction={handleAction}
              />
            );
          }
          if (module === "transformation") {
            return (
              <TransformationCard
                key={module}
                asset={asset}
                onAction={handleAction}
              />
            );
          }
          if (module === "about_us") {
            return (
              <AboutUsCard key={module} asset={asset} onAction={handleAction} />
            );
          }
          return (
            <StartHereCard key={module} asset={asset} onAction={handleAction} />
          );
        })}
      </div>
    </div>
  );
}
