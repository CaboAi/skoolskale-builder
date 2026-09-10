"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { CreatorIntakeSchema, type CreatorIntake } from "@/types/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MODULE_LABELS } from "@/lib/modules/registry";
import { changedFields, staleModulesFor } from "@/lib/creators/stale-modules";
import { Step1CreatorInfo } from "@/app/creators/new/steps/step-1";
import { Step2Offer } from "@/app/creators/new/steps/step-2";
import { Step3Pricing } from "@/app/creators/new/steps/step-3";
import { Step4Voice } from "@/app/creators/new/steps/step-4";
import { Step5AddOns } from "@/app/creators/new/steps/step-5";

type Props = {
  creatorId: string;
  /** Where to return after saving — the package dashboard, when we came from one. */
  returnTo: string;
  initial: CreatorIntake;
};

/**
 * Edit an existing creator's intake.
 *
 * Presented as one scrollable form rather than the wizard's five steps:
 * editing is non-linear, and a VA fixing a community name should not walk
 * through pricing to reach Save. The step components are reused verbatim so
 * the two screens cannot drift in validation or field wording.
 */
export function CreatorEditForm({ creatorId, returnTo, initial }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreatorIntake>({
    // Same cast as the wizard: the resolver is typed against zod's output
    // schema while useForm wants its input. Runtime behavior is correct.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreatorIntakeSchema) as any,
    defaultValues: initial,
    mode: "onChange",
  });

  const { handleSubmit, control, formState } = form;
  // useWatch rather than watch(): the latter is flagged as un-memoizable by
  // the React Compiler, same reason the wizard avoids it.
  const current = useWatch({ control, defaultValue: initial }) as CreatorIntake;

  // Recomputed as the VA types, so the consequences of an edit are visible
  // before saving rather than discovered in the exported package.
  const stale = useMemo(
    () => staleModulesFor(changedFields(initial, current)),
    [initial, current],
  );

  const onSave = handleSubmit(async (values) => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = (await res
          .json()
          .catch(() => ({ error: "Save failed." }))) as { error?: string };
        setError(body.error ?? "Save failed.");
        return;
      }
      router.push(returnTo);
      router.refresh();
    } finally {
      setSaving(false);
    }
  });

  const sections: { title: string; body: React.ReactNode }[] = [
    { title: "Creator & community", body: <Step1CreatorInfo form={form} /> },
    { title: "Offer", body: <Step2Offer form={form} /> },
    { title: "Pricing & terms", body: <Step3Pricing form={form} /> },
    { title: "Voice", body: <Step4Voice form={form} /> },
    { title: "Add-ons", body: <Step5AddOns form={form} /> },
  ];

  return (
    <form onSubmit={onSave} className="space-y-6">
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>{section.body}</CardContent>
        </Card>
      ))}

      {stale.length > 0 ? (
        <div
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <p className="font-medium">
            Saving will not rewrite copy that is already generated.
          </p>
          <p className="mt-1 text-muted-foreground">
            These modules read the fields you changed, so their stored copy
            will be out of date until you regenerate them from the dashboard:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {stale.map((key) => (
              <li key={key}>{MODULE_LABELS[key]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || !formState.isDirty}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save changes
        </Button>
        <Link
          href={returnTo}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
