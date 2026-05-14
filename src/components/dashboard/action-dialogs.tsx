"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { GeneratedAsset } from "@/lib/db/schema";
import { MODULE_LABELS } from "./module-cards";
import { RepeaterField } from "@/components/wizard/RepeaterField";
import { KeywordChipField } from "@/components/wizard/KeywordChipField";
import { AboutUsEditForm } from "./edit-forms/AboutUsEditForm";
import { StartHereEditForm } from "./edit-forms/StartHereEditForm";
import type { AboutUsOutput } from "@/prompts/about-us";
import type { StartHereOutput } from "@/prompts/start-here";

/* -------------------------------------------------------------------------- */
/* Regenerate                                                                  */
/* -------------------------------------------------------------------------- */

export function RegenerateDialog({
  open,
  module,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  module: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string | undefined) => void;
  isPending: boolean;
}) {
  const [note, setNote] = useState("");
  const label = module ? MODULE_LABELS[module] : "";

  // Clear note whenever the dialog flips closed.
  function handleOpenChange(next: boolean) {
    if (!next) setNote("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerate {label}</DialogTitle>
          <DialogDescription>
            A new version will be generated and replace the current one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="regen-note">
            What would you like changed? (optional)
          </Label>
          <Textarea
            id="regen-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. shorter, less spiritual, mention the live calls"
            rows={4}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(note.trim() || undefined)}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isPending ? "Regenerating…" : "Regenerate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit — module-specific forms                                                */
/* -------------------------------------------------------------------------- */

type WelcomeDmContent = { content: string };
type TransformationContent = { candidates: string[] };
type TitleDescriptionContent = { title: string; description: string };
type ClassroomEditContent = { items: TitleDescriptionContent[] };
type LeaderboardContent = { levels: string[] };
type CategoriesContent = {
  categories: { name: string; description: string }[];
};
type DiscoverySeoContent = { keywords: string[] };

const CALENDAR_LIMITS = { titleMax: 30, descriptionMax: 300 } as const;
const CLASSROOM_LIMITS = {
  titleMax: 50,
  descriptionMax: 500,
  maxItems: 10,
} as const;

function EditFormShell({
  description,
  children,
  saving,
  onSave,
  onCancel,
}: {
  description: ReactNode;
  children: ReactNode;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit content</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">{children}</div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Single dialog that swaps its inner form based on `module`. Each form parses
 * its current state into the right shape and calls `onSave(content)` with the
 * payload PATCH expects.
 */
export function EditDialog({
  open,
  module,
  asset,
  onOpenChange,
  onSave,
  isPending,
}: {
  open: boolean;
  module: string | null;
  asset: GeneratedAsset | null;
  onOpenChange: (open: boolean) => void;
  onSave: (content: unknown) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {module && asset ? (
          <EditDialogBody
            module={module}
            asset={asset}
            onSave={onSave}
            onCancel={() => onOpenChange(false)}
            saving={isPending}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditDialogBody({
  module,
  asset,
  onSave,
  onCancel,
  saving,
}: {
  module: string;
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  if (module === "welcome_dm") {
    return (
      <WelcomeDmEditForm
        asset={asset}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "transformation") {
    return (
      <TransformationEditForm
        asset={asset}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "classroom") {
    return (
      <ClassroomEditForm
        asset={asset}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "calendar") {
    return (
      <CalendarEditForm
        asset={asset}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "leaderboard") {
    return (
      <LeaderboardEditForm
        asset={asset}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "categories") {
    return (
      <CategoriesEditForm
        asset={asset}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "discovery_seo") {
    return (
      <DiscoverySeoEditForm
        asset={asset}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "about_us") {
    return (
      <AboutUsEditForm
        initial={asset.content as Partial<AboutUsOutput>}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  if (module === "start_here") {
    return (
      <StartHereEditForm
        initial={asset.content as Partial<StartHereOutput>}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }
  // Defensive fallback. Per the PR #15 audit, no other module currently
  // routes through EditDialog with a structured-only shape — the per-
  // module forms above cover every dispatched module key. Kept so that
  // adding a new module without an explicit form branch surfaces
  // editable JSON instead of a runtime crash.
  return (
    <JsonEditForm
      asset={asset}
      onSave={onSave}
      onCancel={onCancel}
      saving={saving}
    />
  );
}

/* ---------- Welcome DM ---------- */

function WelcomeDmEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initial = (asset.content as WelcomeDmContent).content;
  const [text, setText] = useState(initial);
  return (
    <EditFormShell
      description="Welcome DM body. Must contain #NAME# and #GROUPNAME# merge tags."
      saving={saving}
      onSave={() => onSave({ content: text })}
      onCancel={onCancel}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        className="font-mono text-xs"
      />
    </EditFormShell>
  );
}

/* ---------- Transformation ---------- */

function TransformationEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initial = (asset.content as TransformationContent).candidates;
  const [c1, setC1] = useState(initial[0] ?? "");
  const [c2, setC2] = useState(initial[1] ?? "");
  const [c3, setC3] = useState(initial[2] ?? "");
  return (
    <EditFormShell
      description="Three transformation tagline candidates."
      saving={saving}
      onSave={() => onSave({ candidates: [c1, c2, c3] })}
      onCancel={onCancel}
    >
      {[
        { val: c1, set: setC1, label: "Candidate 1" },
        { val: c2, set: setC2, label: "Candidate 2" },
        { val: c3, set: setC3, label: "Candidate 3" },
      ].map((field, i) => (
        <div key={i} className="space-y-1">
          <Label>{field.label}</Label>
          <Textarea
            value={field.val}
            onChange={(e) => field.set(e.target.value)}
            rows={2}
          />
        </div>
      ))}
    </EditFormShell>
  );
}

/* ---------- About Us / Start Here — JSON editor ---------- */

function JsonEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [text, setText] = useState(() =>
    JSON.stringify(asset.content, null, 2),
  );
  const [parseErr, setParseErr] = useState<string | null>(null);

  function handleSave() {
    try {
      const parsed = JSON.parse(text);
      setParseErr(null);
      onSave(parsed);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <EditFormShell
      description="Edit carefully — the JSON must remain valid and match the module's schema."
      saving={saving}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        className="font-mono text-xs"
      />
      {parseErr && (
        <p className="text-sm text-destructive">JSON parse error: {parseErr}</p>
      )}
    </EditFormShell>
  );
}

/* ---------- Calendar — title + description (single block) ---------- */

function CalendarEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initial = asset.content as TitleDescriptionContent;
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  return (
    <EditFormShell
      description={`${MODULE_LABELS.calendar} title and description.`}
      saving={saving}
      onSave={() => onSave({ title, description })}
      onCancel={onCancel}
    >
      <div className="space-y-1">
        <Label htmlFor="cal-title">
          Title{" "}
          <span className="text-xs text-muted-foreground">
            (max {CALENDAR_LIMITS.titleMax})
          </span>
        </Label>
        <Input
          id="cal-title"
          value={title}
          maxLength={CALENDAR_LIMITS.titleMax}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cal-description">
          Description{" "}
          <span className="text-xs text-muted-foreground">
            (max {CALENDAR_LIMITS.descriptionMax})
          </span>
        </Label>
        <Textarea
          id="cal-description"
          rows={5}
          value={description}
          maxLength={CALENDAR_LIMITS.descriptionMax}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </EditFormShell>
  );
}

/* ---------- Classroom — repeating { title, description } items ---------- */

function ClassroomEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initial = (asset.content as ClassroomEditContent).items.slice(
    0,
    CLASSROOM_LIMITS.maxItems,
  );
  const [items, setItems] = useState<TitleDescriptionContent[]>(initial);

  function updateItem(i: number, patch: Partial<TitleDescriptionContent>) {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const atMax = items.length >= CLASSROOM_LIMITS.maxItems;

  return (
    <EditFormShell
      description={`One title + 2-3 sentence description per classroom (max ${CLASSROOM_LIMITS.maxItems}).`}
      saving={saving}
      onSave={() => onSave({ items })}
      onCancel={onCancel}
    >
      {items.map((item, i) => {
        const titleId = `classroom-edit-title-${i}`;
        const descId = `classroom-edit-description-${i}`;
        return (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Classroom {i + 1}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeItem(i)}
                disabled={items.length <= 1}
              >
                Remove
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor={titleId}>
                Title{" "}
                <span className="text-xs text-muted-foreground">
                  (max {CLASSROOM_LIMITS.titleMax})
                </span>
              </Label>
              <Input
                id={titleId}
                value={item.title}
                maxLength={CLASSROOM_LIMITS.titleMax}
                onChange={(e) => updateItem(i, { title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={descId}>
                Description{" "}
                <span className="text-xs text-muted-foreground">
                  (max {CLASSROOM_LIMITS.descriptionMax})
                </span>
              </Label>
              <Textarea
                id={descId}
                rows={3}
                value={item.description}
                maxLength={CLASSROOM_LIMITS.descriptionMax}
                onChange={(e) =>
                  updateItem(i, { description: e.target.value })
                }
              />
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setItems((prev) => [...prev, { title: "", description: "" }])
        }
        disabled={atMax}
      >
        Add classroom ({items.length}/{CLASSROOM_LIMITS.maxItems})
      </Button>
    </EditFormShell>
  );
}

/* ---------- Leaderboard — 9 level names ---------- */

function LeaderboardEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initial = (asset.content as LeaderboardContent).levels;
  const [levels, setLevels] = useState<string[]>(initial.slice(0, 9));
  return (
    <EditFormShell
      description="Nine leaderboard level names, in order from least- to most-advanced."
      saving={saving}
      onSave={() => onSave({ levels })}
      onCancel={onCancel}
    >
      <RepeaterField
        variant="single"
        legend="Levels"
        rowLabel={(i) => `Level ${i + 1}`}
        values={levels}
        onChange={setLevels}
      />
    </EditFormShell>
  );
}

/* ---------- Categories — 3 named blocks ---------- */

function CategoriesEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initial = (asset.content as CategoriesContent).categories;
  const [rows, setRows] = useState<
    { name: string; description: string }[]
  >(initial.slice(0, 3));
  return (
    <EditFormShell
      description="Three category names with descriptions (introduce, share-wins, creator-advice slots)."
      saving={saving}
      onSave={() => onSave({ categories: rows })}
      onCancel={onCancel}
    >
      <RepeaterField
        variant="grouped"
        legend="Categories"
        rowLabel={(i) => `Category ${i + 1}`}
        values={rows}
        onChange={setRows}
        namePlaceholder="Category name"
        descriptionPlaceholder="One-line description"
      />
    </EditFormShell>
  );
}

/* ---------- Discovery SEO — keyword chips ---------- */

function DiscoverySeoEditForm({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: GeneratedAsset;
  onSave: (content: unknown) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const initial = (asset.content as DiscoverySeoContent).keywords;
  const [keywords, setKeywords] = useState<string[]>(initial);
  return (
    <EditFormShell
      description="Up to 11 keywords surfaced on Skool's Discovery search."
      saving={saving}
      onSave={() => onSave({ keywords })}
      onCancel={onCancel}
    >
      <KeywordChipField
        id="discovery-seo-edit"
        label="Keywords"
        values={keywords}
        onChange={setKeywords}
        max={11}
      />
    </EditFormShell>
  );
}
