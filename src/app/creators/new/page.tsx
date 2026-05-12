import { requireUser } from '@/lib/auth';
import { IntakeWizard } from './wizard';

export default async function NewCreatorPage() {
  await requireUser();
  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            New community
          </h1>
          <p className="text-sm text-muted-foreground">
            Fill in the intake to generate a launch package.
          </p>
        </header>
        <IntakeWizard />
      </div>
    </main>
  );
}
