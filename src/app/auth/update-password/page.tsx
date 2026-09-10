import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { UpdatePasswordForm } from './update-password-form';

/**
 * Reached from a password-recovery link, which lands on /auth/callback first
 * and arrives here with a session already established. requireUser both
 * enforces that (a bare visit with no session bounces to /auth/login) and
 * re-runs the team allowlist check.
 */
export default async function UpdatePasswordPage() {
  await requireUser();

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            You&rsquo;ll use this to sign in from now on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
