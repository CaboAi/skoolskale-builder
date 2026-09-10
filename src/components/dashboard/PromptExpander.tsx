"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Power-user affordance: collapsed by default, opens to reveal the
 * fully-constructed prompt the Inngest function would send for this
 * module given the current creator state. Editing the textarea enables
 * a "Regenerate with edited prompt" button that bypasses the builder
 * entirely (Phase 2; PR follow-up to #13).
 *
 * Collapsed-state DOM is intentionally minimal — when closed, the only
 * footprint is one toggle button so existing card layouts stay
 * byte-identical to pre-Phase-2.
 *
 * Edits are NOT persisted — the next regen without edits reverts to
 * the auto-constructed prompt from the builder. The textarea content
 * lives in component state and clears on collapse.
 */
export function PromptExpander({
  packageId,
  module,
  onRegenerateEdited,
  disabled,
}: {
  packageId: string;
  module: string;
  onRegenerateEdited: (editedPrompt: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editedValue, setEditedValue] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["module-prompt", packageId, module],
    queryFn: async () => {
      const res = await fetch(
        `/api/packages/${packageId}/modules/${module}/prompt`,
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? `Prompt fetch failed (${res.status})`);
      }
      return (await res.json()) as { prompt: string };
    },
    // Lazy: don't fetch until the expander opens.
    enabled: open,
    staleTime: 60_000,
  });

  const autoPrompt = data?.prompt ?? "";
  // editedValue === null means "user hasn't touched the textarea".
  // Once they do, we track their value separately so the auto prompt
  // refetching doesn't blow away their edit.
  const value = editedValue ?? autoPrompt;
  const isEdited =
    editedValue !== null && editedValue.trim() !== autoPrompt.trim();

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev;
      if (!next) setEditedValue(null);
      return next;
    });
  }

  return (
    <div className="w-full border-t pt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={open}
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {open ? "Hide prompt" : "Show prompt"}
        {isEdited && (
          <Badge variant="secondary" className="ml-1 text-[10px] uppercase">
            Edited
          </Badge>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading prompt…
            </div>
          )}
          {isError && (
            <div className="space-y-1.5">
              <p className="text-xs text-destructive">
                {error instanceof Error
                  ? error.message
                  : "Could not load prompt."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          )}
          {!isLoading && !isError && data && (
            <>
              <Textarea
                value={value}
                onChange={(e) => setEditedValue(e.target.value)}
                rows={Math.min(20, Math.max(8, value.split("\n").length + 1))}
                className={cn(
                  "font-mono text-xs leading-relaxed",
                  isEdited && "border-warning/60",
                )}
                placeholder="Edit the prompt…"
                spellCheck={false}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {isEdited
                    ? "Edited prompt overrides the builder for this regeneration only. Not persisted."
                    : "Auto-constructed from your creator profile and pattern library."}
                </p>
                <Button
                  type="button"
                  variant={isEdited ? "default" : "outline"}
                  size="sm"
                  disabled={!isEdited || disabled}
                  onClick={() => onRegenerateEdited(value)}
                >
                  {disabled && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  Regenerate with edited prompt
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
