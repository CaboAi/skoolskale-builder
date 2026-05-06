import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import { ExportView } from "@/components/dashboard/ExportView";
import { MODULE_KEYS, MODULE_REGISTRY } from "@/lib/modules/registry";

const UuidParam = z.string().uuid();

// Modules the user must have approved before /export becomes accessible.
// Filtered to includedByDefault so registered-but-not-yet-generating modules
// (e.g. PR #4 add-ons before PR #5 wires their generators) don't block
// export indefinitely — they have no asset and never get approved.
const REQUIRED_FOR_EXPORT = MODULE_KEYS.filter(
  (m) => MODULE_REGISTRY[m].includedByDefault,
);

type Props = { params: Promise<{ id: string }> };

export default async function PackageExportPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) notFound();

  const details = await getPackageWithDetails(idResult.data, user.id);
  if (!details) notFound();

  // Guard: every required module must have an approved asset.
  const approved = new Set(
    details.assets.filter((a) => a.approved).map((a) => a.module),
  );
  const missing = REQUIRED_FOR_EXPORT.filter((m) => !approved.has(m));
  if (missing.length > 0) {
    redirect(`/packages/${idResult.data}`);
  }

  return (
    <main className="min-h-dvh bg-muted/30 p-4 md:p-8">
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
