import { requireUser } from '@/lib/auth';
import { EmptyState } from '@/components/branding/EmptyState';
import { EmptyPackagesIllustration } from '@/components/branding/EmptyPackagesIllustration';

export default async function Home() {
  const user = await requireUser();
  // No packages list yet — every visit is the empty state. The
  // header's 'New community' button was duplicate of the empty
  // state's CTA, so it's removed. Once the packages list ships,
  // restore the header button so users with existing packages
  // keep a primary action above the fold (and the EmptyState
  // stops rendering when packages.length > 0).
  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Launch packages
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email}
          </p>
        </header>
        <EmptyState
          illustration={<EmptyPackagesIllustration />}
          heading="No launch packages yet"
          body="Build your first community by filling in the creator intake. preSkool generates all 13 modules so your VA can paste them straight into Skool."
          ctaLabel="Build your first package"
          ctaHref="/creators/new"
        />
      </div>
    </main>
  );
}
