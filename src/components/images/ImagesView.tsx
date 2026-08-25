"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Images as ImagesIcon, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SlotPlan } from "@/lib/images/slots";
import { MAX_SLOTS_PER_RUN } from "@/lib/images/slots";
import { ReferenceUploads } from "@/components/images/ReferenceUploads";
import { SlotCard } from "@/components/images/SlotCard";
import { StyleSpecCard } from "@/components/images/StyleSpecCard";
import type { ImagesResponse, ImagesRunSummary } from "@/components/images/types";

/**
 * Wall-clock give-up for polling.
 *
 * 45 minutes, NOT the handover section's 20: a full run is up to 12 SERIAL
 * provider calls at 60-150s each, so half an hour is a healthy run. This
 * matches IMAGES_STALE_RUN_CUTOFF_MS in the API route, which is what lets a
 * stranded run be failed over and the button re-enable.
 */
const IMAGES_POLL_GIVE_UP_MS = 45 * 60_000;

function isActive(run: ImagesRunSummary | null | undefined): boolean {
  return run?.status === "queued" || run?.status === "running";
}

function isPollable(run: ImagesRunSummary | null | undefined): boolean {
  if (!run || !isActive(run)) return false;
  return Date.now() - new Date(run.createdAt).getTime() < IMAGES_POLL_GIVE_UP_MS;
}

export function ImagesView({
  packageId,
  communityName,
}: {
  packageId: string;
  communityName: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["images", packageId] as const;

  const { data, isLoading } = useQuery<ImagesResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/packages/${packageId}/images`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load images (${res.status})`);
      return (await res.json()) as ImagesResponse;
    },
    refetchInterval: (q) => (isPollable(q.state.data?.run) ? 4_000 : false),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const run = data?.run ?? null;
  const active = isActive(run);
  const timedOut = active && !isPollable(run);
  const assets = data?.assets ?? [];
  const assetFor = (key: string) => assets.find((a) => a.slotKey === key);

  const postJson = async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Request failed (${res.status})`);
    }
    return res.json();
  };

  const generateMutation = useMutation({
    mutationFn: () => postJson(`/api/packages/${packageId}/images`),
    onSuccess: (body: { slotCount: number }) => {
      toast.success(`Generating ${body.slotCount} images, one at a time`);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: ({ slot, note }: { slot: SlotPlan; note?: string }) =>
      postJson(
        `/api/packages/${packageId}/images/${slot.kind}/${slot.index}/regenerate`,
        { note },
      ),
    onSuccess: () => {
      toast.success("Queued");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pinMutation = useMutation({
    mutationFn: () => postJson(`/api/packages/${packageId}/images/style`),
    onSuccess: () => {
      toast.success("Deriving art direction…");
      // The pin is a background job; poll once it has had a moment to land.
      setTimeout(invalidate, 3_000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveSpecMutation = useMutation({
    mutationFn: async (spec: unknown) => {
      const res = await fetch(`/api/packages/${packageId}/images/style`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Art direction saved as a new version");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading images…
      </div>
    );
  }

  const { plan, styleSpec, providerConfigured } = data;
  const plannedKeys = new Set(run?.plannedSlotKeys ?? []);
  const doneCount = assets.filter((a) => a.status === "done").length;
  const pendingFor = (key: string) =>
    active && plannedKeys.has(key) && !assetFor(key);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ImagesIcon className="size-5" />
            Images
          </h1>
          <p className="text-sm text-muted-foreground">{communityName}</p>
        </div>
        <div className="flex items-center gap-2">
          {run?.usage ? (
            <Badge variant="outline">
              ${run.usage.costUsd.toFixed(2)} this run
            </Badge>
          ) : null}
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={
              !styleSpec ||
              !providerConfigured ||
              (active && !timedOut) ||
              generateMutation.isPending
            }
          >
            {generateMutation.isPending || (active && !timedOut) ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {active && !timedOut
              ? `Generating ${doneCount}/${plannedKeys.size || plan.auto.length}`
              : "Generate all"}
          </Button>
        </div>
      </header>

      {!providerConfigured ? (
        <Card className="border-amber-500/40">
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <TriangleAlert className="mt-0.5 size-4 text-amber-600" />
            <span>
              <strong>Image provider not configured.</strong> Set{" "}
              <code>OPENAI_API_KEY</code> in the environment to enable
              generation. Everything else on this page works without it.
            </span>
          </CardContent>
        </Card>
      ) : null}

      {run?.status === "failed" && run.error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Run failed: {run.error}
          </CardContent>
        </Card>
      ) : null}

      {timedOut ? (
        <Card className="border-amber-500/40">
          <CardContent className="py-4 text-sm">
            This run has been going longer than 45 minutes and looks stranded.
            Starting a new one will fail it over.
          </CardContent>
        </Card>
      ) : null}

      {run?.usage && run.usage.failedCount > 0 ? (
        <Card className="border-amber-500/40">
          <CardContent className="py-4 text-sm">
            {run.usage.failedCount} of {run.usage.imageCount} images failed. The
            rest are fine — regenerate the failures individually.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <StyleSpecCard
          styleSpec={styleSpec}
          runActive={active && !timedOut}
          pinning={pinMutation.isPending}
          onPin={() => pinMutation.mutate()}
          onSave={(spec) => saveSpecMutation.mutate(spec)}
          saving={saveSpecMutation.isPending}
        />
        <ReferenceUploads
          packageId={packageId}
          references={data.references}
          onChanged={invalidate}
        />
      </div>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Package images ({plan.auto.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plan.auto.map((slot) => (
            <SlotCard
              key={slot.key}
              packageId={packageId}
              slot={slot}
              asset={assetFor(slot.key)}
              pending={pendingFor(slot.key)}
              runActive={active && !timedOut}
              onRegenerate={(s, note) => regenerateMutation.mutate({ slot: s, note })}
              regenerating={
                regenerateMutation.isPending &&
                regenerateMutation.variables?.slot.key === slot.key
              }
            />
          ))}
        </div>
      </section>

      {plan.overflow.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">
              Beyond the run limit ({plan.overflow.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              A run generates at most {MAX_SLOTS_PER_RUN} images so nothing gets
              overwhelmed. Generate these individually when you need them.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plan.overflow.map((slot) => (
              <SlotCard
                key={slot.key}
                packageId={packageId}
                slot={slot}
                asset={assetFor(slot.key)}
                pending={pendingFor(slot.key)}
                runActive={active && !timedOut}
                onRegenerate={(s, note) =>
                  regenerateMutation.mutate({ slot: s, note })
                }
                regenerating={
                  regenerateMutation.isPending &&
                  regenerateMutation.variables?.slot.key === slot.key
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
