"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CreatorIntakeSchema, type CreatorIntake } from "@/types/schemas";

// Shared form type used by each step component. Derived from the actual
// useForm invocation so it matches whatever RHF returns, regardless of
// how the library's generic defaults change between versions.
export type IntakeFormReturn = ReturnType<typeof useForm<CreatorIntake>>;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Step1CreatorInfo } from "./steps/step-1";
import { Step2Offer } from "./steps/step-2";
import { Step3Pricing } from "./steps/step-3";
import { Step4Voice } from "./steps/step-4";

const AUTOSAVE_MS = 30_000;

// Fields to validate on each step's Next click.
const STEP_FIELDS: FieldPath<CreatorIntake>[][] = [
  ["name", "community_name", "niche", "support_contact", "creator_photo_url"],
  ["transformation", "audience", "offer_breakdown"],
  ["pricing", "trial_terms", "refund_policy"],
  ["tone", "brand_prefs"],
];

const DEFAULTS: CreatorIntake = {
  name: "",
  community_name: "",
  niche: "other",
  audience: "",
  transformation: "",
  tone: "loving",
  offer_breakdown: {
    courses: [],
    live_calls: undefined,
    perks: [],
    events: [],
    guest_sessions: false,
  },
  pricing: { monthly: undefined, annual: undefined, tiers: [] },
  trial_terms: { has_trial: false, duration_days: undefined },
  refund_policy: "",
  support_contact: "",
  brand_prefs: "",
  creator_photo_url: undefined,
};

export function IntakeWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef<string>("");

  const form = useForm<CreatorIntake>({
    // Cast: @hookform/resolvers ships a resolver typed against zod's output
    // schema, but useForm wants one that matches its input. Runtime behavior
    // is correct; TS just can't bridge zod's default([]) input-vs-output gap.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreatorIntakeSchema) as any,
    defaultValues: DEFAULTS,
    mode: "onChange",
  });

  const { getValues, trigger, watch } = form;

  // --- POST on Step 1 completion ---
  const createDraft = useCallback(async (): Promise<string | null> => {
    const v = getValues();
    const payload = {
      name: v.name,
      community_name: v.community_name,
      niche: v.niche,
      support_contact: v.support_contact,
      creator_photo_url: v.creator_photo_url,
    };
    const res = await fetch("/api/creators", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Create failed" }));
      setError(err.error ?? "Create failed");
      return null;
    }
    const row = (await res.json()) as { id: string };
    return row.id;
  }, [getValues]);

  // --- PATCH (shared by autosave + final submit) ---
  const patchCreator = useCallback(
    async (id: string, partial: Partial<CreatorIntake>): Promise<boolean> => {
      if (Object.keys(partial).length === 0) return true;
      const res = await fetch(`/api/creators/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        setError(err.error ?? "Save failed");
        return false;
      }
      return true;
    },
    [],
  );

  // --- Autosave: every 30s, PATCH diffs since last save. ---
  const formState = watch();
  useEffect(() => {
    if (!creatorId) return;
    const timer = setInterval(() => {
      const snapshot = JSON.stringify(formState);
      if (snapshot === lastSavedRef.current) return;
      void patchCreator(creatorId, formState).then((ok) => {
        if (ok) lastSavedRef.current = snapshot;
      });
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [creatorId, formState, patchCreator]);

  const goNext = async () => {
    setError(null);
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields, { shouldFocus: true });
    if (!valid) return;

    // Step 1 → create draft
    if (step === 0 && !creatorId) {
      setSubmitting(true);
      const id = await createDraft();
      setSubmitting(false);
      if (!id) return;
      setCreatorId(id);
      // First PATCH will happen on autosave tick or next advance.
    }

    setStep((s) => s + 1);
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const onFinalSubmit = async () => {
    setError(null);
    if (!creatorId) {
      setError("No draft id — please go back to Step 1.");
      return;
    }
    const valid = await trigger(STEP_FIELDS[3], { shouldFocus: true });
    if (!valid) return;

    setSubmitting(true);
    try {
      const ok = await patchCreator(creatorId, getValues());
      if (!ok) return;

      // Create the launch_package row.
      const pkgRes = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ creator_id: creatorId }),
      });
      if (!pkgRes.ok) {
        const err = await pkgRes
          .json()
          .catch(() => ({ error: "Could not create package." }));
        setError(err.error ?? "Could not create package.");
        return;
      }
      const pkg = (await pkgRes.json()) as { id: string };

      // Kick off generation. Failure here doesn't strand the user — the
      // dashboard surfaces a 'draft' status and offers a retry.
      const genRes = await fetch(`/api/packages/${pkg.id}/generate`, {
        method: "POST",
      });
      if (!genRes.ok && genRes.status !== 409) {
        const err = await genRes
          .json()
          .catch(() => ({ error: "Could not start generation." }));
        setError(err.error ?? "Could not start generation.");
        return;
      }

      router.push(`/packages/${pkg.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = 4;
  const progressPct = ((step + 1) / totalSteps) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>
            Step {step + 1} of {totalSteps}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {creatorId ? "Autosaving…" : "Draft"}
          </span>
        </CardTitle>
        <Progress value={progressPct} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {step === 0 && <Step1CreatorInfo form={form} />}
          {step === 1 && <Step2Offer form={form} />}
          {step === 2 && <Step3Pricing form={form} />}
          {step === 3 && <Step4Voice form={form} />}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={step === 0 || submitting}
            >
              Back
            </Button>
            {step < totalSteps - 1 ? (
              <Button type="button" onClick={goNext} disabled={submitting}>
                {submitting ? "Saving…" : "Next"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onFinalSubmit}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Create launch package"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
