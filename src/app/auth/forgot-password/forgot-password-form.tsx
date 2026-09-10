'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus({ kind: 'sending' });

    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=%2Fauth%2Fupdate-password`,
    });

    // Errors here are rate-limit or misconfiguration, never "no such user" —
    // Supabase deliberately does not reveal whether an address is registered,
    // and neither does the confirmation copy below.
    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    setStatus({ kind: 'sent' });
  }

  if (status.kind === 'sent') {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium">Check your inbox.</p>
        <p className="text-muted-foreground">
          If that address belongs to a team member, a password reset link is on
          its way. The link expires after an hour.
        </p>
        <Link
          href="/auth/login"
          className="inline-block underline underline-offset-4"
        >
          Back to sign in
        </Link>
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
        <p className="text-sm text-destructive" role="alert">
          {status.message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={status.kind === 'sending'}
      >
        {status.kind === 'sending' ? 'Sending…' : 'Send reset link'}
      </Button>

      <Link
        href="/auth/login"
        className="block text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Back to sign in
      </Link>
    </form>
  );
}
