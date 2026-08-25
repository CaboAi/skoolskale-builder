"use client";

import Image from "next/image";
import { useState } from "react";
import { Loader2, AlertTriangle, Download, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { SlotPlan } from "@/lib/images/slots";
import type { ImageAssetSummary } from "@/components/images/types";

type Props = {
  packageId: string;
  slot: SlotPlan;
  asset?: ImageAssetSummary;
  /** True while a run covering this slot is in flight. */
  pending: boolean;
  /** True while any run is active — blocks every per-slot action. */
  runActive: boolean;
  onRegenerate: (slot: SlotPlan, note?: string) => void;
  regenerating: boolean;
};

export function SlotCard({
  packageId,
  slot,
  asset,
  pending,
  runActive,
  onRegenerate,
  regenerating,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState("");

  const done = asset?.status === "done" && asset.url;
  const failed = asset?.status === "failed";
  // The image was generated from a title that has since changed in the DNA.
  // Ordinal slot keys mean the image is still attached — it is just stale.
  const titleDrift =
    Boolean(asset) &&
    Boolean(slot.titleText) &&
    asset?.slotTitle != null &&
    asset.slotTitle !== slot.titleText;

  const aspect = slot.target.width / slot.target.height;

  return (
    <Card className="overflow-hidden p-0">
      <div
        className="relative w-full bg-muted"
        style={{ aspectRatio: `${aspect}` }}
      >
        {pending || regenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Skeleton className="absolute inset-0" />
            <Loader2 className="relative size-5 animate-spin text-muted-foreground" />
            <span className="relative text-xs text-muted-foreground">
              Generating…
            </span>
          </div>
        ) : done ? (
          <Image
            src={asset.url as string}
            alt={slot.label}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertTriangle className="size-5 text-destructive" />
            <span className="text-xs text-muted-foreground line-clamp-3">
              {asset?.error ?? "Generation failed."}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Not generated</span>
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{slot.label}</p>
            <p className="text-xs text-muted-foreground">
              {slot.target.width}&times;{slot.target.height}
              {asset?.version ? ` · v${asset.version}` : ""}
            </p>
          </div>
          {failed ? (
            <Badge variant="destructive">Failed</Badge>
          ) : done ? (
            <Badge variant="secondary">Ready</Badge>
          ) : null}
        </div>

        {titleDrift ? (
          <p className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
            Title changed since this was generated — regenerate to match.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={runActive || regenerating}
            onClick={() => setDialogOpen(true)}
          >
            <RefreshCw className="mr-1 size-3" />
            {asset ? "Regenerate" : "Generate"}
          </Button>
          {done ? (
            <a
              href={`/api/packages/${packageId}/images/${slot.kind}/${slot.index}/download`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              <Download className="size-3" />
              <span className="sr-only">Download {slot.label}</span>
            </a>
          ) : null}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{asset ? "Regenerate" : "Generate"} {slot.label}</DialogTitle>
            <DialogDescription>
              The pinned art direction is reused, so this stays in the same
              family as the other images. Add a note only for what should
              change.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional — e.g. darker background, less text weight"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onRegenerate(slot, note.trim() || undefined);
                setNote("");
                setDialogOpen(false);
              }}
            >
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
