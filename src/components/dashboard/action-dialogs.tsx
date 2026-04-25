"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { GeneratedAsset } from "@/lib/db/schema";
import { MODULE_LABELS } from "./module-cards";

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
            {isPending ? "Queuing…" : "Regenerate"}
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
  // about_us, start_here → JSON editor.
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
