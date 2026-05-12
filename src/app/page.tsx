import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAllPackagesForListing } from '@/lib/db/packages';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/branding/EmptyState';
import { EmptyPackagesIllustration } from '@/components/branding/EmptyPackagesIllustration';
import { PackagesList } from '@/components/dashboard/PackagesList';

export default async function Home() {
  const user = await requireUser();
  const packages = await getAllPackagesForListing();

  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Launch packages
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.email}
            </p>
          </div>
          {packages.length > 0 && (
            <Link href="/creators/new" className={cn(buttonVariants())}>
              <Plus className="mr-1.5 h-4 w-4" />
              New community
            </Link>
          )}
        </header>
        {packages.length === 0 ? (
          <EmptyState
            illustration={<EmptyPackagesIllustration />}
            heading="No launch packages yet"
            body="Build your first community by filling in the creator intake. preSkool generates all 13 modules so your VA can paste them straight into Skool."
            ctaLabel="Build your first package"
            ctaHref="/creators/new"
          />
        ) : (
          <PackagesList packages={packages} />
        )}
      </div>
    </main>
  );
}
