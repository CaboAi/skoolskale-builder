import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import { ExportView } from "@/components/dashboard/ExportView";

const UuidParam = z.string().uuid();
const REQUIRED_MODULES = [
  "welcome_dm",
  "transformation",
  "about_us",
  "start_here",
  "cover",
] as const;

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
  const missing = REQUIRED_MODULES.filter((m) => !approved.has(m));
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
