"use client";

import { useState } from "react";
import { Loader2, Palette, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ImageStyleSpecSchema } from "@/lib/images/style-spec";
import type { PinnedStyleSpecSummary } from "@/components/images/types";

type Props = {
  styleSpec: PinnedStyleSpecSummary | null;
  runActive: boolean;
  pinning: boolean;
  onPin: () => void;
  onSave: (spec: unknown) => void;
  saving: boolean;
};

const SWATCH_KEYS = ["background", "surface", "primary", "accent"] as const;

export function StyleSpecCard({
  styleSpec,
  runActive,
  pinning,
  onPin,
  onSave,
  saving,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmRepin, setConfirmRepin] = useState(false);

  const openEditor = () => {
    setDraft(JSON.stringify(styleSpec?.spec ?? {}, null, 2));
    setError(null);
    setEditing(true);
  };

  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (err) {
      setError(`Not valid JSON: ${(err as Error).message}`);
      return;
    }
    // Same schema the server enforces — fail here rather than round-tripping
    // a 400.
    const result = ImageStyleSpecSchema.safeParse(parsed);
    if (!result.success) {
      setError(
        result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n"),
      );
      return;
    }
    onSave(result.data);
    setEditing(false);
  };

  if (!styleSpec) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" />
            Art direction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nothing pinned yet. Pinning reads the approved package and produces
            one style spec that every image in this package will follow — it is
            what keeps the classroom covers looking like a set.
          </p>
          <Button onClick={onPin} disabled={pinning || runActive}>
            {pinning ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Pin art direction
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { spec } = styleSpec;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4" />
          Art direction
          <Badge variant="secondary">v{styleSpec.version}</Badge>
          {styleSpec.source === "fallback" ? (
            <Badge variant="outline">preset fallback</Badge>
          ) : null}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openEditor}>
            <Pencil className="mr-1 size-3" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={runActive || pinning}
            onClick={() => setConfirmRepin(true)}
          >
            Re-pin
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {SWATCH_KEYS.map((key) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span
                className="size-8 rounded border"
                style={{ backgroundColor: spec.palette[key] }}
                aria-label={`${key} ${spec.palette[key]}`}
              />
              <span className="text-[10px] text-muted-foreground">{key}</span>
            </div>
          ))}
        </div>

        <p className="text-sm">{spec.artDirection.summary}</p>

        <div className="flex flex-wrap gap-1">
          {spec.artDirection.moodKeywords.map((k) => (
            <Badge key={k} variant="outline" className="text-xs">
              {k}
            </Badge>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-medium">Medium: </dt>
            <dd className="inline">{spec.artDirection.medium}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Lighting: </dt>
            <dd className="inline">{spec.lighting.key}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Layout: </dt>
            <dd className="inline">{spec.composition.bannerLayout}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Type: </dt>
            <dd className="inline">
              {spec.typography.family} / {spec.typography.weight}
            </dd>
          </div>
        </dl>
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit art direction</DialogTitle>
            <DialogDescription>
              Saving creates a new version. Existing images keep the spec they
              were made with — regenerate them to adopt this one.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-96 font-mono text-xs"
            spellCheck={false}
          />
          {error ? (
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </pre>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save as new version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRepin} onOpenChange={setConfirmRepin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-derive the art direction?</DialogTitle>
            <DialogDescription>
              Images already generated will NOT match the new direction until
              you regenerate them. If you only want a small change, edit the
              spec instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRepin(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onPin();
                setConfirmRepin(false);
              }}
            >
              Re-pin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
