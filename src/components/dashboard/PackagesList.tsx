"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PackageListItem } from "@/lib/db/packages";

/**
 * Workspace-wide library of launch packages. Click a row to open the
 * package detail; the trash icon at the right end of each row opens a
 * confirmation dialog and (on confirm) calls DELETE /api/packages/[id],
 * optimistically removing the row from the local list.
 */
export function PackagesList({
  packages,
}: {
  packages: PackageListItem[];
}) {
  const [items, setItems] = useState(packages);
  const [pending, setPending] = useState<PackageListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pending) return;
    const target = pending;
    setDeleting(true);
    // Optimistic removal — restore on failure.
    setItems((prev) => prev.filter((p) => p.id !== target.id));
    setPending(null);
    try {
      const res = await fetch(`/api/packages/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      toast.success("Package deleted");
    } catch (err) {
      setItems((prev) =>
        prev.some((p) => p.id === target.id) ? prev : [...prev, target],
      );
      toast.error(
        err instanceof Error ? err.message : "Could not delete package",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ul className="divide-y rounded-md border bg-card">
        {items.map((pkg) => (
          <li
            key={pkg.id}
            className="flex items-stretch transition-colors hover:bg-muted/40"
          >
            <Link
              href={`/packages/${pkg.id}`}
              className="flex flex-1 items-center px-4 py-3"
            >
              <span className="flex-1 truncate text-sm font-medium">
                {pkg.communityName || "Untitled community"}
              </span>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPending(pkg);
              }}
              aria-label={`Delete ${pkg.communityName || "package"}`}
              className="flex items-center px-3 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div
              className="flex items-center pr-4 text-muted-foreground"
              aria-hidden
            >
              <ChevronRight className="h-4 w-4 shrink-0" />
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete package?</DialogTitle>
            <DialogDescription>
              {pending
                ? `This will permanently delete ${pending.communityName || "this package"} and all its generated content. This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPending(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
