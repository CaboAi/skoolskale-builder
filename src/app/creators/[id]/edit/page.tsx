import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { creators } from "@/lib/db/schema";
import { creatorToIntake } from "@/lib/creators/to-intake";
import { CreatorEditForm } from "./edit-form";

const UuidParam = z.string().uuid();

type Props = {
  params: Promise<{ id: string }>;
  /** `?from=/packages/<id>` so Save and Cancel return where the VA came from. */
  searchParams: Promise<{ from?: string }>;
};

export default async function EditCreatorPage({ params, searchParams }: Props) {
  await requireUser();
  const { id } = await params;
  const { from } = await searchParams;

  const idResult = UuidParam.safeParse(id);
  if (!idResult.success) notFound();

  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, idResult.data))
    .limit(1);
  if (!creator) notFound();

  // Only same-origin paths are honoured, so a crafted `from` can't turn Save
  // into an offsite redirect.
  const returnTo = from?.startsWith("/") ? from : "/";

  return (
    <main className="flex-1 bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit intake
          </h1>
          <p className="text-muted-foreground">
            {creator.name} · {creator.communityName}
          </p>
        </header>
        <CreatorEditForm
          creatorId={creator.id}
          returnTo={returnTo}
          initial={creatorToIntake(creator)}
        />
      </div>
    </main>
  );
}
