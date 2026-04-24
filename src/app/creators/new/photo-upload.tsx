'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

const BUCKET = 'creator-photos';

type Props = {
  value: string | null | undefined;
  onChange: (url: string | undefined) => void;
};

export function PhotoUpload({ value, onChange }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so selecting the same file again retriggers
    if (!file) return;

    setStatus('uploading');
    setErrMsg(null);

    const supabase = createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      setStatus('error');
      setErrMsg('Not signed in.');
      return;
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) {
      setStatus('error');
      setErrMsg(upErr.message);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setStatus('idle');
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3">
          <Image
            src={value}
            alt="Creator photo"
            width={64}
            height={64}
            unoptimized
            className="size-16 rounded-md border object-cover"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(undefined)}
          >
            Remove
          </Button>
        </div>
      ) : null}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFile}
          className="sr-only"
        />
        {status === 'uploading'
          ? 'Uploading…'
          : value
            ? 'Replace photo'
            : 'Upload photo'}
      </label>
      {errMsg ? (
        <p className="text-xs text-destructive">{errMsg}</p>
      ) : null}
    </div>
  );
}
