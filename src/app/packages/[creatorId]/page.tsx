import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Props = { params: Promise<{ creatorId: string }> };

export default async function PackageLandingPage({ params }: Props) {
  await requireUser();
  const { creatorId } = await params;

  return (
    <main className="min-h-dvh bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Intake saved</CardTitle>
            <CardDescription>
              Sprint 3 will render the launch package dashboard for this creator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Creator ID:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {creatorId}
              </code>
            </p>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
