import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import { PackageDashboard } from "@/components/dashboard/PackageDashboard";

const UuidParam = z.string().uuid();

type Props = { params: Promise<{ id: string }> };

export default async function PackagePage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) notFound();

  const details = await getPackageWithDetails(idResult.data, user.id);
  if (!details) notFound();

  return (
    <main className="min-h-dvh bg-muted/30 p-4 md:p-8">
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
