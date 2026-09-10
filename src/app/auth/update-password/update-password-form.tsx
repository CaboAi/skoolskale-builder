'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  MIN_PASSWORD_LENGTH,
  passwordProblemMessage,
  validateNewPassword,
} from '@/lib/auth/password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const problem = validateNewPassword(password, confirmation);
    if (problem) {
      setStatus({ kind: 'error', message: passwordProblemMessage(problem)! });
      return;
    }

    setStatus({ kind: 'saving' });

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }

    // The recovery link already established a session, so there is nothing
    // further to sign in to — go straight to the app.
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={status.kind === 'saving'}
        />
        <p className="text-xs text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirm new password</Label>
        <Input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          disabled={status.kind === 'saving'}
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
        disabled={status.kind === 'saving'}
      >
        {status.kind === 'saving' ? 'Saving…' : 'Set password'}
      </Button>
    </form>
  );
}
