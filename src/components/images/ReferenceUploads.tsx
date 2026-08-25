"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { ImageReferenceSummary } from "@/components/images/types";

/**
 * Two reference drop zones.
 *
 * Uploads go client-side straight to Supabase Storage (bucket policy allows
 * authenticated inserts), then POST the resulting path to the API, which
 * validates it sits under this package's prefix before persisting.
 *
 * Ported from the creator-photo upload deleted in PR #42, with one change:
 * the bucket is PRIVATE now, so previews come from the signed URL the poll
 * returns rather than getPublicUrl.
 */

const BUCKET = "image-references";
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

type Kind = "headshot" | "brand_kit";

const LABELS: Record<Kind, { title: string; hint: string }> = {
  headshot: {
    title: "Creator headshot",
    hint: "Used only where the art direction allows a person — About Us and Start Here.",
  },
  brand_kit: {
    title: "Brand kit",
    hint: "Colours and type are read off this image when the art direction is pinned.",
  },
};

function DropZone({
  packageId,
  kind,
  current,
  onChanged,
}: {
  packageId: string;
  kind: Kind;
  current?: ImageReferenceSummary;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("That file is over the 10 MB limit.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${packageId}/${kind}-${crypto.randomUUID()}.${ext}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw new Error(error.message);

      const res = await fetch(`/api/packages/${packageId}/images/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, path, mime: file.type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Upload failed (${res.status})`);
      }

      toast.success(`${LABELS[kind].title} uploaded`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/packages/${packageId}/images/references`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error(`Could not remove (${res.status})`);
      toast.success(`${LABELS[kind].title} removed`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded border bg-muted">
        {current?.url ? (
          <Image
            src={current.url}
            alt={LABELS[kind].title}
            fill
            unoptimized
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Upload className="size-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{LABELS[kind].title}</p>
        <p className="text-xs text-muted-foreground">{LABELS[kind].hint}</p>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
            {current ? "Replace" : "Upload"}
          </Button>
          {current ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
              <X className="size-3" />
              <span className="sr-only">Remove {LABELS[kind].title}</span>
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}

export function ReferenceUploads({
  packageId,
  references,
  onChanged,
}: {
  packageId: string;
  references: ImageReferenceSummary[];
  onChanged: () => void;
}) {
  const byKind = (kind: Kind) => references.find((r) => r.kind === kind);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reference images</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DropZone
          packageId={packageId}
          kind="headshot"
          current={byKind("headshot")}
          onChanged={onChanged}
        />
        <DropZone
          packageId={packageId}
          kind="brand_kit"
          current={byKind("brand_kit")}
          onChanged={onChanged}
        />
      </CardContent>
    </Card>
  );
}
