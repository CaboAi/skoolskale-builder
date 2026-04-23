'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus({ kind: 'sending' });

    const supabase = createClient();
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    setStatus({ kind: 'sent', email });
  }

  if (status.kind === 'sent') {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">Check your inbox.</p>
        <p className="text-muted-foreground">
          We sent a sign-in link to <strong>{status.email}</strong>. Click it to
          continue.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status.kind === 'sending'}
          placeholder="you@skoolskale.com"
        />
      </div>

      {status.kind === 'error' ? (
        <p className="text-sm text-destructive">{status.message}</p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={status.kind === 'sending'}
      >
        {status.kind === 'sending' ? 'Sending…' : 'Send magic link'}
      </Button>
    </form>
  );
}
