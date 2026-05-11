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

export default async function Home() {
  const user = await requireUser();
  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Launch packages
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.email}
            </p>
          </div>
          <Link
            href="/creators/new"
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            New community
          </Link>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Create a launch package by filling in the creator intake form.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Packages you&rsquo;ve started will show up here in a future sprint.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}