"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  HANDOVER_DOC_FILENAMES,
  HANDOVER_DOC_LABELS,
  type HandoverDocKey,
} from "@/prompts/handover/deliverables";

/* -------------------------------------------------------------------------- */
/* API response shapes (dates arrive as ISO strings over JSON)                */
/* -------------------------------------------------------------------------- */

type HandoverRunSummary = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  includeGuestEmails: boolean;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

type HandoverDocSummary = {
  id: string;
  runId: string;
  docKey: HandoverDocKey;
  version: number;
  pdfPath: string | null;
  /**
   * True when ANY version of this doc has a rendered PDF — the download
   * route serves the newest one, so the link stays valid even while a
   * regeneration's fresh row hasn't rendered yet.
   */
  pdfAvailable: boolean;
  wordCount: number;
  placeholderCount: number;
  createdAt: string;
};

type HandoverResponse = {
  run: HandoverRunSummary | null;
  documents: HandoverDocSummary[];
};

/**
 * Wall-clock give-up for polling. A run spans 5 sequential-ish Opus calls
 * plus a PDF render — far past the module pipeline's 6-minute pattern —
 * so the backstop is generous. Past it we stop polling; a manual refresh
 * (or regenerate) picks the state back up.
 */
const HANDOVER_POLL_GIVE_UP_MS = 20 * 60_000;

const DOC_ORDER = Object.keys(HANDOVER_DOC_FILENAMES) as HandoverDocKey[];

function isActive(run: HandoverRunSummary | null | undefined): boolean {
  return run?.status === "queued" || run?.status === "running";
}

function isPollable(run: HandoverRunSummary | null | undefined): boolean {
  if (!run || !isActive(run)) return false;
  return Date.now() - new Date(run.createdAt).getTime() < HANDOVER_POLL_GIVE_UP_MS;
}

/* -------------------------------------------------------------------------- */
/* HandoverSection                                                             */
/* -------------------------------------------------------------------------- */

export function HandoverSection({ packageId }: { packageId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["handover", packageId] as const;
  const [includeGuestEmails, setIncludeGuestEmails] = useState(false);

  const { data } = useQuery<HandoverResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/packages/${packageId}/handover`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load handover (${res.status})`);
      return (await res.json()) as HandoverResponse;
    },
    refetchInterval: (q) => (isPollable(q.state.data?.run) ? 5_000 : false),
  });

  const run = data?.run ?? null;
  const documents = data?.documents ?? [];
  const active = isActive(run);
  const timedOut = active && !isPollable(run);

  const renderPdfsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/packages/${packageId}/handover/render-pdfs`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Could not start PDF rendering." }));
        throw new Error(err.error ?? "Could not start PDF rendering.");
      }
      return (await res.json()) as { runId: string };
    },
    onSuccess: () => {
      toast.success("Rendering PDFs from the existing documents");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/packages/${packageId}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeGuestEmails }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Could not start handover generation." }));
        throw new Error(err.error ?? "Could not start handover generation.");
      }
      return (await res.json()) as { runId: string };
    },
    onSuccess: () => {
      toast.success("Handover generation started — this takes several minutes");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const hasDocs = documents.length > 0;
  const orderedDocs = DOC_ORDER.map((key) =>
    documents.find((d) => d.docKey === key),
  ).filter((d): d is HandoverDocSummary => d !== undefined);
  // Documents exist but some never rendered — offer the free retry instead
  // of making the VA pay for a full regeneration to recover PDFs.
  const missingPdfs = hasDocs && orderedDocs.some((d) => !d.pdfAvailable);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Pre-Launch Handover
            </CardTitle>
            <CardDescription>
              Generates the client marketing package: VSL + cancellation
              scripts, pre/post-launch email sequences, docuseries script, DM
              flows, and a placeholder checklist — as markdown + PDFs.
            </CardDescription>
          </div>
          {run && <RunBadge run={run} timedOut={timedOut} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-2 text-sm sm:items-center">
            <Checkbox
              checked={includeGuestEmails}
              onCheckedChange={(v) => setIncludeGuestEmails(v === true)}
              disabled={active}
            />
            <span>
              Include guest-speaker email sequence
              <span className="block text-xs text-muted-foreground">
                Only if the guest confirmed they&apos;ll mail their own list
              </span>
            </span>
          </label>
          <div className="flex shrink-0 items-center gap-2">
            {missingPdfs && (
              <Button
                variant="outline"
                onClick={() => renderPdfsMutation.mutate()}
                disabled={(active && !timedOut) || renderPdfsMutation.isPending}
                title="Re-render PDFs from the documents already generated — no AI cost"
              >
                {renderPdfsMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Render PDFs
              </Button>
            )}
            <Button
              onClick={() => generateMutation.mutate()}
              // A timed-out run re-enables the button: the POST route fails
              // over any active run past the same 20-min cutoff, so the VA
              // can recover a stranded run without manual SQL.
              disabled={(active && !timedOut) || generateMutation.isPending}
            >
              {((active && !timedOut) || generateMutation.isPending) && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {active && !timedOut
                ? "Generating…"
                : hasDocs || timedOut
                  ? "Regenerate Handover"
                  : "Generate Handover"}
            </Button>
          </div>
        </div>
        {missingPdfs && !active && (
          <p className="text-sm text-muted-foreground">
            Documents are generated but some PDFs are missing.{" "}
            <strong>Render PDFs</strong> rebuilds them from the existing copy
            at no AI cost — regenerating would re-run the writing step.
          </p>
        )}

        {run?.status === "failed" && run.error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Last run failed: {run.error}
          </p>
        )}
        {timedOut && (
          <p className="text-sm text-muted-foreground">
            No response after 20 minutes — this run is presumed dead.
            Regenerate to start fresh (the stuck run is failed over
            automatically), or refresh in case it finished late.
          </p>
        )}

        {orderedDocs.length > 0 && (
          <ul className="divide-y rounded-md border">
            {orderedDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {HANDOVER_DOC_LABELS[doc.docKey]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {doc.wordCount.toLocaleString("en-US")} words
                  </span>
                  {doc.placeholderCount > 0 ? (
                    <Badge variant="outline" className="text-xs">
                      {doc.placeholderCount} to fill
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      no placeholders
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {doc.pdfAvailable && (
                    <a
                      href={`/api/packages/${packageId}/handover/documents/${doc.docKey}/pdf`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      PDF
                    </a>
                  )}
                  <a
                    href={`/api/packages/${packageId}/handover/documents/${doc.docKey}/md`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                    )}
                  >
                    .md
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        {active && !hasDocs && (
          <p className="text-sm text-muted-foreground">
            Documents appear here as each one finishes — the full package
            takes several minutes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RunBadge({
  run,
  timedOut,
}: {
  run: HandoverRunSummary;
  timedOut: boolean;
}) {
  if (timedOut) return <Badge variant="outline">unresponsive</Badge>;
  switch (run.status) {
    case "queued":
    case "running":
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          {run.status}
        </Badge>
      );
    case "done":
      return <Badge variant="secondary">generated</Badge>;
    case "failed":
      return <Badge variant="destructive">failed</Badge>;
    case "cancelled":
      return <Badge variant="outline">cancelled</Badge>;
  }
}
