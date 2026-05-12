"use client";

import { useState } from "react";
import { useFieldArray, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AboutUsSchema, type AboutUsOutput } from "@/prompts/about-us";

/**
 * Structured edit form for the About Us module (PR #15 follow-up).
 *
 * Replaces the JsonEditForm fallback with a tabbed surface that mirrors
 * the rendered card's information architecture:
 *   - Hero          → hero + trial_callout (top-of-page text)
 *   - Value Buckets → 3-6 buckets, each {emoji, header, items: 2-8 strings}
 *   - Pricing       → single line
 *   - Refund        → single line
 *
 * Validation rides the existing AboutUsSchema (zodResolver). The schema
 * already enforces every limit the prompt promised — bucket count,
 * item count, char ranges — so submit either succeeds with a payload
 * the model would have produced, or surfaces inline errors.
 *
 * Malformed-data handling: graceful render. RHF accepts whatever the
 * caller passes as defaultValues; missing fields stay undefined and
 * surface as required-field errors only on submit. Existing assets
 * generated under prior schemas open in the form rather than throwing
 * a "shape unrecognized" wall.
 */

type TabKey = "hero" | "buckets" | "pricing" | "refund";

const MIN_BUCKETS = 3;
const MAX_BUCKETS = 6;
const MIN_ITEMS = 2;
const MAX_ITEMS = 8;

type Props = {
  initial: Partial<AboutUsOutput>;
  onSave: (content: AboutUsOutput) => void;
  onCancel: () => void;
  saving: boolean;
};

export function AboutUsEditForm({
  initial,
  onSave,
  onCancel,
  saving,
}: Props) {
  const [tab, setTab] = useState<TabKey>("hero");

  const form = useForm<AboutUsOutput>({
    // Cast: zodResolver's input/output type discrepancy on schemas with
    // .min()/.max() — same pattern used in src/app/creators/new/wizard.tsx.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(AboutUsSchema) as any,
    defaultValues: {
      hero: initial.hero ?? "",
      trial_callout: initial.trial_callout ?? "",
      value_buckets: initial.value_buckets ?? [
        { emoji: "", header: "", items: ["", ""] },
      ],
      pricing: initial.pricing ?? "",
      refund_policy: initial.refund_policy ?? "",
    },
    mode: "onSubmit",
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  const bucketArray = useFieldArray({ control, name: "value_buckets" });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold leading-none">Edit About Us</h2>
        <p className="text-sm text-muted-foreground">
          Tabbed editor — hero / value buckets / pricing / refund. Validated
          against the same schema the model writes against.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList variant="line">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="buckets">Value Buckets</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="refund">Refund</TabsTrigger>
        </TabsList>

        {/* HERO TAB */}
        <TabsContent value="hero" className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hero">Hero</Label>
            <Textarea
              id="hero"
              rows={3}
              maxLength={300}
              {...register("hero")}
              aria-invalid={errors.hero ? true : undefined}
            />
            {errors.hero ? (
              <p className="text-xs text-destructive">{errors.hero.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trial_callout">Trial callout</Label>
            <Textarea
              id="trial_callout"
              rows={2}
              maxLength={200}
              {...register("trial_callout")}
              aria-invalid={errors.trial_callout ? true : undefined}
            />
            {errors.trial_callout ? (
              <p className="text-xs text-destructive">
                {errors.trial_callout.message}
              </p>
            ) : null}
          </div>
        </TabsContent>

        {/* VALUE BUCKETS TAB */}
        <TabsContent value="buckets" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {bucketArray.fields.length} of {MAX_BUCKETS} buckets (min{" "}
              {MIN_BUCKETS})
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bucketArray.fields.length >= MAX_BUCKETS}
              onClick={() =>
                bucketArray.append({
                  emoji: "",
                  header: "",
                  items: ["", ""],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add bucket
            </Button>
          </div>
          {errors.value_buckets?.message ? (
            <p className="text-xs text-destructive">
              {errors.value_buckets.message}
            </p>
          ) : null}
          <div className="space-y-3">
            {bucketArray.fields.map((bucket, i) => (
              <BucketEditor
                key={bucket.id}
                index={i}
                control={control}
                register={register}
                onMoveUp={
                  i > 0 ? () => bucketArray.move(i, i - 1) : undefined
                }
                onMoveDown={
                  i < bucketArray.fields.length - 1
                    ? () => bucketArray.move(i, i + 1)
                    : undefined
                }
                onRemove={
                  bucketArray.fields.length > MIN_BUCKETS
                    ? () => bucketArray.remove(i)
                    : undefined
                }
                bucketError={errors.value_buckets?.[i] as BucketError}
              />
            ))}
          </div>
        </TabsContent>

        {/* PRICING TAB */}
        <TabsContent value="pricing" className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pricing">Pricing line</Label>
            <Textarea
              id="pricing"
              rows={3}
              maxLength={200}
              {...register("pricing")}
              aria-invalid={errors.pricing ? true : undefined}
            />
            <p className="text-xs text-muted-foreground">
              One line summarizing monthly/annual + any savings.
            </p>
            {errors.pricing ? (
              <p className="text-xs text-destructive">
                {errors.pricing.message}
              </p>
            ) : null}
          </div>
        </TabsContent>

        {/* REFUND TAB */}
        <TabsContent value="refund" className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="refund_policy">Refund policy</Label>
            <Textarea
              id="refund_policy"
              rows={4}
              maxLength={300}
              {...register("refund_policy")}
              aria-invalid={errors.refund_policy ? true : undefined}
            />
            {errors.refund_policy ? (
              <p className="text-xs text-destructive">
                {errors.refund_policy.message}
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

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
/* BucketEditor — one bucket card with emoji + header + items repeater        */
/* -------------------------------------------------------------------------- */

type BucketError = {
  emoji?: { message?: string };
  header?: { message?: string };
  items?: ({ message?: string } | undefined)[] & { message?: string };
} | undefined;

function BucketEditor({
  index,
  control,
  register,
  onMoveUp,
  onMoveDown,
  onRemove,
  bucketError,
}: {
  index: number;
  control: Control<AboutUsOutput>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  bucketError: BucketError;
}) {
  const itemArray = useFieldArray({
    control,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: `value_buckets.${index}.items` as any,
  });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Bucket {index + 1}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!onMoveUp}
            onClick={onMoveUp}
            aria-label="Move bucket up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!onMoveDown}
            onClick={onMoveDown}
            aria-label="Move bucket down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!onRemove}
            onClick={onRemove}
            aria-label="Remove bucket"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[60px_1fr] gap-2">
        <div className="space-y-1.5">
          <Label
            htmlFor={`bucket-${index}-emoji`}
            className="text-xs"
          >
            Emoji
          </Label>
          <Input
            id={`bucket-${index}-emoji`}
            maxLength={4}
            {...register(`value_buckets.${index}.emoji`)}
            aria-invalid={bucketError?.emoji ? true : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor={`bucket-${index}-header`}
            className="text-xs"
          >
            Header
          </Label>
          <Input
            id={`bucket-${index}-header`}
            maxLength={60}
            {...register(`value_buckets.${index}.header`)}
            aria-invalid={bucketError?.header ? true : undefined}
          />
          {bucketError?.header?.message ? (
            <p className="text-xs text-destructive">
              {bucketError.header.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            Items ({itemArray.fields.length} of {MAX_ITEMS}, min {MIN_ITEMS})
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={itemArray.fields.length >= MAX_ITEMS}
            onClick={() => itemArray.append("" as never)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add item
          </Button>
        </div>
        {itemArray.fields.map((item, j) => (
          <div key={item.id} className="flex items-start gap-1.5">
            <Input
              {...register(`value_buckets.${index}.items.${j}`)}
              placeholder={`Item ${j + 1}`}
              aria-invalid={
                bucketError?.items?.[j]?.message ? true : undefined
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={itemArray.fields.length <= MIN_ITEMS}
              onClick={() => itemArray.remove(j)}
              aria-label={`Remove item ${j + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {bucketError?.items?.message ? (
          <p className="text-xs text-destructive">
            {bucketError.items.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
