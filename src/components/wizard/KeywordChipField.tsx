"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { commitChip, removeChipAt } from "./keyword-chip-logic";

/**
 * Chip input for Skool's Discovery search keywords. Mirrors the Skool
 * Discovery screenshot: typed text becomes a removable chip on Enter or
 * comma; max enforces an upper bound (Skool currently allows 11). Empty
 * input + Backspace removes the trailing chip.
 *
 * Stateless w.r.t. RHF — parent passes `values` and `onChange`. The internal
 * `draft` is the unsubmitted text the user is currently typing.
 */
export type KeywordChipFieldProps = {
  id: string;
  label?: string;
  values: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
  error?: string;
};

export function KeywordChipField({
  id,
  label,
  values,
  onChange,
  max = 11,
  placeholder = "Type a keyword and press Enter",
  error,
}: KeywordChipFieldProps) {
  const [draft, setDraft] = useState("");
  const atMax = values.length >= max;

  function commit(raw: string) {
    const result = commitChip(values, raw, max);
    if (result.committed) onChange(result.values);
    // Clear the draft on dedupe/blank too — user expectation is that pressing
    // Enter empties the input, even if the value was a duplicate.
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && values.length > 0) {
      e.preventDefault();
      onChange(values.slice(0, -1));
    }
  }

  function removeAt(i: number) {
    onChange(removeChipAt(values, i));
  }

  return (
    <div className="space-y-1.5">
      {label ? (
        <Label htmlFor={id}>
          {label}{" "}
          <span className="text-xs text-muted-foreground">
            ({values.length}/{max})
          </span>
        </Label>
      ) : null}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent p-1.5",
          error && "border-destructive",
        )}
      >
        {values.map((kw, i) => (
          <Badge
            key={`${kw}-${i}`}
            variant="secondary"
            className="gap-1 pl-2 pr-1"
          >
            <span>{kw}</span>
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${kw}`}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={atMax ? `Limit reached (${max})` : placeholder}
          disabled={atMax && draft === ""}
          className="h-7 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
