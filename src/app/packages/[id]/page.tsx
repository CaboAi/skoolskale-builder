import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import { PackageDashboard } from "@/components/dashboard/PackageDashboard";

const UuidParam = z.string().uuid();

// Signed image URLs are time-sensitive — re-render fully on every request
// rather than serving a cached HTML/RSC payload with stale tokens.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PackagePage({ params }: Props) {
  await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) notFound();

  const details = await getPackageWithDetails(idResult.data);
  if (!details) notFound();

  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <PackageDashboard
          package={details.package}
          creator={details.creator}
          assets={details.assets}
        />
      </div>
    </main>
  );
}
