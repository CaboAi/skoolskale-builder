import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PackageListItem } from "@/lib/db/packages";

/**
 * Workspace-wide library of launch packages. Single-column MVP per the
 * 2026-05-12 spec — community name only, click a row to open the package.
 * Status badges, creator name, last-updated, search/filter are intentionally
 * deferred; see `packages-dashboard-future.md` in memory for the v2 plan.
 *
 * Server component — pure render, no client state.
 */
export function PackagesList({ packages }: { packages: PackageListItem[] }) {
  return (
    <ul className="divide-y rounded-md border bg-card">
      {packages.map((pkg) => (
        <li key={pkg.id}>
          <Link
            href={`/packages/${pkg.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <span className="truncate text-sm font-medium">
              {pkg.communityName || "Untitled community"}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
