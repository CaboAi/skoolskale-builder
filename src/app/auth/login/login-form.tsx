'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status =
  | { kind: 'idle' }
  | { kind: 'signing-in' }
  | { kind: 'sending-link' }
  | { kind: 'link-sent'; email: string }
  | { kind: 'error'; message: string };

const BUSY: Status['kind'][] = ['signing-in', 'sending-link'];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const busy = BUSY.includes(status.kind);

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setStatus({ kind: 'signing-in' });

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }

    // The allowlist gate lives in src/proxy.ts, which runs on this
    // navigation — a non-allowlisted address lands on /auth/not-allowed
    // rather than `next`. refresh() makes the server components re-read
    // the session cookie the sign-in just wrote.
    router.replace(next.startsWith('/') ? next : '/');
    router.refresh();
  }

  async function onMagicLink() {
    if (!email) {
      setStatus({
        kind: 'error',
        message: 'Enter your email address first.',
      });
      return;
    }
    setStatus({ kind: 'sending-link' });

    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    setStatus({ kind: 'link-sent', email });
  }

  if (status.kind === 'link-sent') {
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
    <form onSubmit={onPasswordSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          placeholder="you@skoolskale.com"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/auth/forgot-password"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </div>

      {status.kind === 'error' ? (
        <p className="text-sm text-destructive" role="alert">
          {status.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {status.kind === 'signing-in' ? 'Signing in…' : 'Sign in'}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onMagicLink}
        disabled={busy}
      >
        {status.kind === 'sending-link'
          ? 'Sending…'
          : 'Email me a magic link instead'}
      </Button>
    </form>
  );
}
