"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Creator, GeneratedAsset, LaunchPackage } from "@/lib/db/schema";
import {
  AboutUsCard,
  COPY_MODULES,
  CopyModuleSkeleton,
  CoverCard,
  CoverSkeleton,
  MODULE_LABELS,
  StartHereCard,
  TransformationCard,
  WelcomeDmCard,
  type ModuleActionHandler,
} from "./module-cards";
import { EditDialog, RegenerateDialog } from "./action-dialogs";

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

/**
 * Defensive UI for the rare case where a user lands on the dashboard with
 * status='draft' and no assets — generation never started or was cancelled.
 * Offers a one-click recovery rather than leaving the user stranded.
 */
function DraftEmptyState({ packageId }: { packageId: string }) {
  const queryClient = useQueryClient();
  const startGeneration = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/packages/${packageId}/generate`, {
        method: "POST",
      });
      if (!res.ok && res.status !== 409) {
        const err = await res
          .json()
          .catch(() => ({ error: "Could not start generation." }));
        throw new Error(err.error ?? "Could not start generation.");
      }
    },
    onSuccess: () => {
      toast.success("Generation started");
      void queryClient.invalidateQueries({ queryKey: ["package", packageId] });
    },
    onError: (err) => {
      toast.error(`Could not start generation: ${err.message}`);
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generation hasn&apos;t started yet</CardTitle>
        <CardDescription>
          The launch package was created but the generation pipeline never
          kicked off. Start it now to produce the 5 modules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => startGeneration.mutate()}
          disabled={startGeneration.isPending}
        >
          {startGeneration.isPending && (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          )}
          {startGeneration.isPending ? "Starting…" : "Start generation"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* PackageDashboard                                                            */
/* -------------------------------------------------------------------------- */

export function PackageDashboard(initial: PackageDashboardProps) {
  const queryClient = useQueryClient();
  const queryKey = ["package", initial.package.id] as const;

  // Track per-module "regenerating" state. Value = the asset id that was
  // latest at the moment regeneration started. When a NEW row arrives for
  // that module (different id), regeneration is considered complete.
  const [regenerating, setRegenerating] = useState<
    Record<string, string | null>
  >({});

  const { data } = useQuery<PackageWithDetails>({
    queryKey,
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
    refetchInterval: (q) => {
      const cur = q.state.data;
      if (!cur) return false;
      if (cur.package.status === "generating") return 5_000;
      // Anything regenerating? Poll every 3s.
      return Object.keys(regenerating).length > 0 ? 3_000 : false;
    },
  });

  const { package: pkg, creator, assets } = data;
  // Keyed by string (not the enum union) so loose handlers can `.get(mod)`
  // without per-call casts.
  const byModule = new Map<string, GeneratedAsset>(
    assets.map((a) => [a.module, a]),
  );
  const approvedCount = assets.filter((a) => a.approved).length;

  // When an asset's id changes for a module we're regenerating, we're done.
  for (const [mod, startId] of Object.entries(regenerating)) {
    const asset = byModule.get(mod);
    if (asset && asset.id !== startId) {
      // Schedule removal after render (setState in render is a no-op if
      // already set — the ref comparison avoids infinite loops).
      queueMicrotask(() => {
        setRegenerating((prev) => {
          if (prev[mod] === undefined) return prev;
          const next = { ...prev };
          delete next[mod];
          return next;
        });
        toast.success(`${MODULE_LABELS[mod]} regenerated`);
      });
    }
  }

  /* ---------- Dialog state ---------- */

  const [regenDialog, setRegenDialog] = useState<{ module: string | null }>({
    module: null,
  });
  const [editDialog, setEditDialog] = useState<{ module: string | null }>({
    module: null,
  });

  /* ---------- Mutations ---------- */

  const approveMutation = useMutation({
    mutationFn: async (module: string) => {
      const res = await fetch(
        `/api/packages/${pkg.id}/modules/${module}/approve`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Approve failed" }));
        throw new Error(err.error ?? "Approve failed");
      }
      return (await res.json()) as GeneratedAsset;
    },
    onMutate: async (module: string) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<PackageWithDetails>(queryKey);
      if (prev) {
        queryClient.setQueryData<PackageWithDetails>(queryKey, {
          ...prev,
          assets: prev.assets.map((a) =>
            a.module === module ? { ...a, approved: true } : a,
          ),
        });
      }
      return { prev };
    },
    onError: (err, module, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error(`Could not approve ${MODULE_LABELS[module]}: ${err.message}`);
    },
    onSuccess: (_data, module) => {
      toast.success(`${MODULE_LABELS[module]} approved`);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ module, note }: { module: string; note?: string }) => {
      const res = await fetch(
        `/api/packages/${pkg.id}/modules/${module}/regenerate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note }),
        },
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Regenerate failed" }));
        throw new Error(err.error ?? "Regenerate failed");
      }
      return module;
    },
    onSuccess: (module) => {
      const currentId = byModule.get(module)?.id ?? null;
      setRegenerating((prev) => ({ ...prev, [module]: currentId }));
      setRegenDialog({ module: null });
      toast.info(`Regenerating ${MODULE_LABELS[module]}…`);
    },
    onError: (err, { module }) => {
      toast.error(
        `Could not regenerate ${MODULE_LABELS[module]}: ${err.message}`,
      );
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({
      module,
      content,
    }: {
      module: string;
      content: unknown;
    }) => {
      const res = await fetch(`/api/packages/${pkg.id}/modules/${module}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error ?? "Save failed");
      }
      return (await res.json()) as GeneratedAsset;
    },
    onSuccess: (updated, { module }) => {
      // Replace the module's asset in the cache with the PATCH response.
      queryClient.setQueryData<PackageWithDetails>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assets: prev.assets.map((a) => (a.module === module ? updated : a)),
        };
      });
      setEditDialog({ module: null });
      toast.success(`${MODULE_LABELS[module]} saved. Re-approve when ready.`);
    },
    onError: (err, { module }) => {
      toast.error(`Could not save ${MODULE_LABELS[module]}: ${err.message}`);
    },
  });

  // Variant selection is a presentation choice, not a content edit, so it
  // doesn't go through the PATCH endpoint. See /modules/cover/select-variant.
  const selectVariantMutation = useMutation({
    mutationFn: async (index: number) => {
      const res = await fetch(
        `/api/packages/${pkg.id}/modules/cover/select-variant`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ index }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error ?? "Save failed");
      }
      return (await res.json()) as GeneratedAsset;
    },
    onMutate: async (index: number) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<PackageWithDetails>(queryKey);
      if (prev) {
        queryClient.setQueryData<PackageWithDetails>(queryKey, {
          ...prev,
          assets: prev.assets.map((a) => {
            if (a.module !== "cover") return a;
            const content = a.content as {
              variants: unknown[];
              selected_variant_index?: number;
            };
            return {
              ...a,
              content: { ...content, selected_variant_index: index },
            };
          }),
        });
      }
      return { prev };
    },
    onSuccess: (_updated, index) => {
      toast.success(`Variant ${index + 1} selected`);
    },
    onError: (err, _index, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error(`Could not select variant: ${err.message}`);
    },
  });

  /* ---------- Action dispatch ---------- */

  const handleAction: ModuleActionHandler = (module, action) => {
    if (action === "approve") {
      approveMutation.mutate(module);
      return;
    }
    if (action === "regenerate") {
      setRegenDialog({ module });
      return;
    }
    if (action === "edit") {
      setEditDialog({ module });
      return;
    }
  };

  const handleSelectVariant = (index: number) => {
    selectVariantMutation.mutate(index);
  };

  /* ---------- Render ---------- */

  const editAsset = editDialog.module
    ? (byModule.get(editDialog.module) ?? null)
    : null;

  // Per-module pending action — drives the spinner on the card footer.
  const pendingApproveModule = approveMutation.isPending
    ? (approveMutation.variables ?? null)
    : null;
  function pendingActionFor(module: string) {
    return pendingApproveModule === module ? ("approve" as const) : null;
  }

  const selectingVariantIndex = selectVariantMutation.isPending
    ? (selectVariantMutation.variables ?? null)
    : null;

  function renderCopyCard(module: (typeof COPY_MODULES)[number]) {
    const asset = byModule.get(module);
    if (!asset || regenerating[module] !== undefined) {
      return <CopyModuleSkeleton key={module} module={module} />;
    }
    const pa = pendingActionFor(module);
    if (module === "welcome_dm") {
      return (
        <WelcomeDmCard
          key={module}
          asset={asset}
          onAction={handleAction}
          pendingAction={pa}
        />
      );
    }
    if (module === "transformation") {
      return (
        <TransformationCard
          key={module}
          asset={asset}
          onAction={handleAction}
          pendingAction={pa}
        />
      );
    }
    if (module === "about_us") {
      return (
        <AboutUsCard
          key={module}
          asset={asset}
          onAction={handleAction}
          pendingAction={pa}
        />
      );
    }
    return (
      <StartHereCard
        key={module}
        asset={asset}
        onAction={handleAction}
        pendingAction={pa}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {creator.name}
          </h1>
          <p className="truncate text-muted-foreground">
            {creator.communityName}
          </p>
          <p className="text-sm text-muted-foreground">
            {approvedCount} of 5 modules approved
          </p>
        </div>
        <StatusBadge status={pkg.status} />
      </header>

      {pkg.status === "draft" && assets.length === 0 ? (
        <DraftEmptyState packageId={pkg.id} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {byModule.has("cover") && regenerating.cover === undefined ? (
            <CoverCard
              asset={byModule.get("cover")!}
              onAction={handleAction}
              onSelectVariant={handleSelectVariant}
              pendingAction={pendingActionFor("cover")}
              selectingIndex={selectingVariantIndex}
            />
          ) : (
            <CoverSkeleton />
          )}
          {COPY_MODULES.map(renderCopyCard)}
        </div>
      )}

      {approvedCount === 5 && (
        <div className="flex justify-end">
          <Link
            href={`/packages/${pkg.id}/export`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "px-6 text-base font-semibold",
            )}
          >
            Export package →
          </Link>
        </div>
      )}

      <RegenerateDialog
        open={regenDialog.module !== null}
        module={regenDialog.module}
        onOpenChange={(open) =>
          setRegenDialog(open ? regenDialog : { module: null })
        }
        onConfirm={(note) => {
          if (regenDialog.module) {
            regenerateMutation.mutate({ module: regenDialog.module, note });
          }
        }}
        isPending={regenerateMutation.isPending}
      />

      <EditDialog
        open={editDialog.module !== null}
        module={editDialog.module}
        asset={editAsset}
        onOpenChange={(open) =>
          setEditDialog(open ? editDialog : { module: null })
        }
        onSave={(content) => {
          if (editDialog.module) {
            editMutation.mutate({ module: editDialog.module, content });
          }
        }}
        isPending={editMutation.isPending}
      />
    </div>
  );
}
