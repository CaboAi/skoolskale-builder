import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import { ExportView } from "@/components/dashboard/ExportView";
import { getMissingRequiredModules } from "@/lib/modules/registry";

const UuidParam = z.string().uuid();

// Export page embeds signed image URLs in every variant `<Image>` and every
// Download button href — re-render on every request to avoid stale tokens.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PackageExportPage({ params }: Props) {
  await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) notFound();

  const details = await getPackageWithDetails(idResult.data);
  if (!details) notFound();

  // Guard: every required module must have an approved asset.
  if (getMissingRequiredModules(details.assets).length > 0) {
    redirect(`/packages/${idResult.data}`);
  }

  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <ExportView
          package={details.package}
          creator={details.creator}
          assets={details.assets}
        />
      </div>
    </main>
  );
}
