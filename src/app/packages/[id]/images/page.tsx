import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getPackageWithDetails } from "@/lib/db/packages";
import { ImagesView } from "@/components/images/ImagesView";

const UuidParam = z.string().uuid();

/**
 * The images workspace.
 *
 * Deliberately isolated: no module cards, no handover section, no export
 * controls. When a VA is doing images they should see images and nothing
 * else — that separation is the reason this is its own route rather than
 * another section on the export page.
 *
 * force-dynamic because every thumbnail is a signed URL with an hour TTL;
 * a cached render would hand out expired links.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PackageImagesPage({ params }: Props) {
  await requireUser();
  const { id } = await params;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) notFound();

  const details = await getPackageWithDetails(idResult.data);
  if (!details) notFound();

  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <Link
          href={`/packages/${idResult.data}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to package
        </Link>
        <ImagesView
          packageId={idResult.data}
          communityName={details.creator.communityName}
        />
      </div>
    </main>
  );
}
