'use client';

import type { IntakeFormReturn } from '../wizard';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type Props = { form: IntakeFormReturn };

export function Step2Offer({ form }: Props) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const offer = watch('offer_breakdown');

  const setPerks = (perks: string[]) =>
    setValue('offer_breakdown.perks', perks, { shouldDirty: true });

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-medium">The offer</h2>

      <div className="space-y-1.5">
        <Label htmlFor="transformation">Transformation</Label>
        <Textarea
          id="transformation"
          rows={3}
          {...register('transformation')}
          placeholder="What change do members experience after joining?"
        />
        {errors.transformation?.message ? (
          <p className="text-xs text-destructive">
            {errors.transformation.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audience">Audience</Label>
        <Textarea
          id="audience"
          rows={2}
          {...register('audience')}
          placeholder="Who is this community for?"
        />
        {errors.audience?.message ? (
          <p className="text-xs text-destructive">{errors.audience.message}</p>
        ) : null}
      </div>

      {/* Perks */}
      <StringListField
        label="Perks"
        placeholder="Private podcast, community Q&A, ..."
        values={offer.perks}
        onChange={setPerks}
      />

      {/* Guest sessions */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          {...register('offer_breakdown.guest_sessions')}
          className="size-4"
        />
        Guest sessions / expert drop-ins
      </label>
    </section>
  );
}

function StringListField({
  label,
  placeholder,
  values,
  onChange,
  maxItems,
}: {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
  maxItems?: number;
}) {
  const atMax = maxItems !== undefined && values.length >= maxItems;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...values, ''])}
        disabled={atMax}
      >
        Add {label.toLowerCase().replace(/s$/, '')}
        {maxItems !== undefined ? ` (${values.length}/${maxItems})` : ''}
      </Button>
    </div>
  );
}
