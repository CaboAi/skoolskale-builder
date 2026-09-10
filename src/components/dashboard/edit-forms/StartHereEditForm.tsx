"use client";

import { useFieldArray, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StartHereSchema, type StartHereOutput } from "@/prompts/start-here";

/**
 * Structured edit form for the Start Here module (PR #15 follow-up).
 *
 * Layout: stacked sections (no tabs). The 4 steps are fixed by the
 * schema and each has a different shape, so a stacked-with-headers
 * layout reads more naturally than tabs would. The cards visually
 * mirror StartHereCard's accordion presentation.
 *
 * Step shapes:
 *   1. how_to_use:        title + sections[3-10] {name, description}
 *   2. community_rules:   title + rules[3-10] strings
 *   3. faqs:              array[4-10] {question, answer_template}
 *   4. need_assistance:   title + template
 *
 * Validation rides StartHereSchema (zodResolver) — every limit the
 * prompt promises is enforced.
 *
 * Malformed-data handling: graceful render. RHF accepts the partial
 * defaults; missing nested arrays surface as required-field errors
 * only on submit, so existing assets generated under prior schemas
 * open in the form rather than throwing a "shape unrecognized" wall.
 */

const SEC_MIN = 3;
const SEC_MAX = 10;
const RULE_MIN = 3;
const RULE_MAX = 10;
const FAQ_MIN = 4;
const FAQ_MAX = 10;

type Props = {
  initial: Partial<StartHereOutput>;
  onSave: (content: StartHereOutput) => void;
  onCancel: () => void;
  saving: boolean;
};

export function StartHereEditForm({
  initial,
  onSave,
  onCancel,
  saving,
}: Props) {
  const form = useForm<StartHereOutput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(StartHereSchema) as any,
    defaultValues: {
      step_1_how_to_use: {
        title: initial.step_1_how_to_use?.title ?? "",
        sections: initial.step_1_how_to_use?.sections ?? [
          { name: "", description: "" },
          { name: "", description: "" },
          { name: "", description: "" },
        ],
      },
      step_2_community_rules: {
        title: initial.step_2_community_rules?.title ?? "",
        rules: initial.step_2_community_rules?.rules ?? ["", "", ""],
      },
      step_3_faqs: initial.step_3_faqs ?? [
        { question: "", answer_template: "" },
        { question: "", answer_template: "" },
        { question: "", answer_template: "" },
        { question: "", answer_template: "" },
      ],
      step_4_need_assistance: {
        title: initial.step_4_need_assistance?.title ?? "",
        template: initial.step_4_need_assistance?.template ?? "",
      },
    },
    mode: "onSubmit",
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold leading-none">
          Edit Start Here
        </h2>
        <p className="text-sm text-muted-foreground">
          Stacked editor for the 4-step onboarding doc. Validated against the
          same schema the model writes against.
        </p>
      </header>

      <Step1Section control={control} register={register} errors={errors} />
      <Step2Section control={control} register={register} errors={errors} />
      <Step3Section control={control} register={register} errors={errors} />
      <Step4Section register={register} errors={errors} />

      <footer className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </footer>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step section helpers                                                        */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorsBag = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Register = any;

function SectionShell({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-semibold">
        Step {step}: {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Step1Section({
  control,
  register,
  errors,
}: {
  control: Control<StartHereOutput>;
  register: Register;
  errors: ErrorsBag;
}) {
  const sections = useFieldArray({
    control,
    name: "step_1_how_to_use.sections",
  });
  return (
    <SectionShell step={1} title="How to use">
      <div className="space-y-1.5">
        <Label htmlFor="step1-title">Title</Label>
        <Input
          id="step1-title"
          maxLength={120}
          {...register("step_1_how_to_use.title")}
          aria-invalid={
            errors.step_1_how_to_use?.title ? true : undefined
          }
        />
        {errors.step_1_how_to_use?.title?.message ? (
          <p className="text-xs text-destructive">
            {errors.step_1_how_to_use.title.message}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sections.fields.length} of {SEC_MAX} sections (min {SEC_MIN})
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={sections.fields.length >= SEC_MAX}
          onClick={() => sections.append({ name: "", description: "" })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add section
        </Button>
      </div>
      {sections.fields.map((s, i) => (
        <div key={s.id} className="space-y-1.5 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Section {i + 1}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={i === 0}
                onClick={() => sections.move(i, i - 1)}
                aria-label="Move section up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={i === sections.fields.length - 1}
                onClick={() => sections.move(i, i + 1)}
                aria-label="Move section down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={sections.fields.length <= SEC_MIN}
                onClick={() => sections.remove(i)}
                aria-label="Remove section"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Input
            placeholder="Name"
            maxLength={80}
            {...register(`step_1_how_to_use.sections.${i}.name`)}
          />
          <Textarea
            placeholder="Description"
            rows={2}
            maxLength={400}
            {...register(`step_1_how_to_use.sections.${i}.description`)}
          />
        </div>
      ))}
    </SectionShell>
  );
}

function Step2Section({
  control,
  register,
  errors,
}: {
  control: Control<StartHereOutput>;
  register: Register;
  errors: ErrorsBag;
}) {
  const rules = useFieldArray({
    control,
    // useFieldArray needs an object-shaped path; rules[] is strings, so we
    // wrap the index in an object via the register call below. The cast
    // here matches RHF's expected signature for primitive arrays.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: "step_2_community_rules.rules" as any,
  });
  return (
    <SectionShell step={2} title="Community rules">
      <div className="space-y-1.5">
        <Label htmlFor="step2-title">Title</Label>
        <Input
          id="step2-title"
          maxLength={120}
          {...register("step_2_community_rules.title")}
        />
        {errors.step_2_community_rules?.title?.message ? (
          <p className="text-xs text-destructive">
            {errors.step_2_community_rules.title.message}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {rules.fields.length} of {RULE_MAX} rules (min {RULE_MIN})
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={rules.fields.length >= RULE_MAX}
          onClick={() => rules.append("" as never)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add rule
        </Button>
      </div>
      {rules.fields.map((r, i) => (
        <div key={r.id} className="flex items-start gap-1.5">
          <Input
            placeholder={`Rule ${i + 1}`}
            maxLength={300}
            {...register(`step_2_community_rules.rules.${i}`)}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={rules.fields.length <= RULE_MIN}
            onClick={() => rules.remove(i)}
            aria-label={`Remove rule ${i + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </SectionShell>
  );
}

function Step3Section({
  control,
  register,
  errors,
}: {
  control: Control<StartHereOutput>;
  register: Register;
  errors: ErrorsBag;
}) {
  const faqs = useFieldArray({ control, name: "step_3_faqs" });
  return (
    <SectionShell step={3} title="FAQs">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {faqs.fields.length} of {FAQ_MAX} FAQs (min {FAQ_MIN})
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={faqs.fields.length >= FAQ_MAX}
          onClick={() =>
            faqs.append({ question: "", answer_template: "" })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add FAQ
        </Button>
      </div>
      {errors.step_3_faqs?.message ? (
        <p className="text-xs text-destructive">
          {errors.step_3_faqs.message}
        </p>
      ) : null}
      {faqs.fields.map((f, i) => (
        <div key={f.id} className="space-y-1.5 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              FAQ {i + 1}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={faqs.fields.length <= FAQ_MIN}
              onClick={() => faqs.remove(i)}
              aria-label={`Remove FAQ ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="Question"
            maxLength={250}
            {...register(`step_3_faqs.${i}.question`)}
          />
          <Textarea
            placeholder="Answer template"
            rows={3}
            maxLength={2000}
            {...register(`step_3_faqs.${i}.answer_template`)}
          />
        </div>
      ))}
    </SectionShell>
  );
}

function Step4Section({
  register,
  errors,
}: {
  register: Register;
  errors: ErrorsBag;
}) {
  return (
    <SectionShell step={4} title="Need assistance">
      <div className="space-y-1.5">
        <Label htmlFor="step4-title">Title</Label>
        <Input
          id="step4-title"
          maxLength={120}
          {...register("step_4_need_assistance.title")}
        />
        {errors.step_4_need_assistance?.title?.message ? (
          <p className="text-xs text-destructive">
            {errors.step_4_need_assistance.title.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="step4-template">Template</Label>
        <Textarea
          id="step4-template"
          rows={4}
          maxLength={500}
          {...register("step_4_need_assistance.template")}
        />
        {errors.step_4_need_assistance?.template?.message ? (
          <p className="text-xs text-destructive">
            {errors.step_4_need_assistance.template.message}
          </p>
        ) : null}
      </div>
    </SectionShell>
  );
}
