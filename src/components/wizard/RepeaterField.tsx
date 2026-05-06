"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Fixed-row repeater for wizard step 5.
 *
 * Two shapes:
 *  - "single": each row is a string (used for leaderboard level names)
 *  - "grouped": each row is { name, description } (used for categories)
 *
 * Row count is fixed by the schema (9 leaderboard levels, 3 categories), so
 * there's no add/remove UI — the wizard renders exactly N rows and the user
 * fills them in. Errors surface per-row.
 */

type SingleRow = string;
type GroupedRow = { name: string; description: string };

type SingleErrors = (string | undefined)[];
type GroupedErrors = ({ name?: string; description?: string } | undefined)[];

type SingleProps = {
  variant: "single";
  legend: string;
  rowLabel: (i: number) => string;
  values: SingleRow[];
  onChange: (next: SingleRow[]) => void;
  rowPlaceholder?: (i: number) => string;
  errors?: SingleErrors;
};

type GroupedProps = {
  variant: "grouped";
  legend: string;
  rowLabel: (i: number) => string;
  values: GroupedRow[];
  onChange: (next: GroupedRow[]) => void;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  errors?: GroupedErrors;
};

export function RepeaterField(props: SingleProps | GroupedProps) {
  if (props.variant === "single") {
    const { legend, rowLabel, values, onChange, rowPlaceholder, errors } =
      props;
    return (
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{legend}</legend>
        {values.map((value, i) => {
          const id = `repeater-single-${i}`;
          const err = errors?.[i];
          return (
            <div key={i} className="space-y-1.5">
              <Label htmlFor={id} className="text-xs text-muted-foreground">
                {rowLabel(i)}
              </Label>
              <Input
                id={id}
                value={value}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder={rowPlaceholder?.(i)}
                aria-invalid={err ? true : undefined}
              />
              {err ? (
                <p className="text-xs text-destructive">{err}</p>
              ) : null}
            </div>
          );
        })}
      </fieldset>
    );
  }

  const {
    legend,
    rowLabel,
    values,
    onChange,
    namePlaceholder,
    descriptionPlaceholder,
    errors,
  } = props;
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">{legend}</legend>
      {values.map((value, i) => {
        const nameId = `repeater-grouped-${i}-name`;
        const descId = `repeater-grouped-${i}-description`;
        const err = errors?.[i];
        return (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {rowLabel(i)}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor={nameId} className="text-xs">
                Name
              </Label>
              <Input
                id={nameId}
                value={value.name}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = { ...next[i], name: e.target.value };
                  onChange(next);
                }}
                placeholder={namePlaceholder}
                aria-invalid={err?.name ? true : undefined}
              />
              {err?.name ? (
                <p className="text-xs text-destructive">{err.name}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={descId} className="text-xs">
                Description
              </Label>
              <Textarea
                id={descId}
                rows={2}
                value={value.description}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = { ...next[i], description: e.target.value };
                  onChange(next);
                }}
                placeholder={descriptionPlaceholder}
                aria-invalid={err?.description ? true : undefined}
              />
              {err?.description ? (
                <p className="text-xs text-destructive">{err.description}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
