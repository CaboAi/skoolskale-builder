'use client';

import type { IntakeFormReturn } from '../wizard';
import type { CreatorIntake } from '@/types/schemas';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type Props = { form: IntakeFormReturn };

export function Step3Pricing({ form }: Props) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const pricing = watch('pricing');
  const trial = watch('trial_terms');

  const setTiers = (tiers: CreatorIntake['pricing']['tiers']) =>
    setValue('pricing.tiers', tiers, { shouldDirty: true });

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-medium">Pricing &amp; terms</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="monthly">Monthly price (USD)</Label>
          <Input
            id="monthly"
            type="number"
            step="1"
            {...register('pricing.monthly', {
              setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
            })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="annual">Annual price (USD)</Label>
          <Input
            id="annual"
            type="number"
            step="1"
            {...register('pricing.annual', {
              setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
            })}
          />
        </div>
      </div>

      {/* Tiers */}
      <div className="space-y-2">
        <Label>Additional tiers (optional)</Label>
        {pricing.tiers.map((t, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={t.name}
              onChange={(e) => {
                const next = [...pricing.tiers];
                next[i] = { ...next[i], name: e.target.value };
                setTiers(next);
              }}
              placeholder="Tier name (e.g. VIP)"
            />
            <Input
              value={t.price}
              onChange={(e) => {
                const next = [...pricing.tiers];
                next[i] = { ...next[i], price: e.target.value };
                setTiers(next);
              }}
              placeholder="Price (text)"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setTiers(pricing.tiers.filter((_, idx) => idx !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setTiers([...pricing.tiers, { name: '', price: '' }])}
        >
          Add tier
        </Button>
      </div>

      {/* Trial */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            {...register('trial_terms.has_trial')}
            className="size-4"
          />
          Offers a trial
        </label>
        {trial.has_trial ? (
          <div className="space-y-1.5">
            <Label htmlFor="trial_days">Trial duration (days)</Label>
            <Input
              id="trial_days"
              type="number"
              step="1"
              {...register('trial_terms.duration_days', {
                setValueAs: (v) =>
                  v === '' || v == null ? undefined : Number(v),
              })}
            />
          </div>
        ) : null}
      </div>

      {/* Refund policy */}
      <div className="space-y-1.5">
        <Label htmlFor="refund_policy">Refund policy</Label>
        <Textarea
          id="refund_policy"
          rows={3}
          {...register('refund_policy')}
          placeholder="14-day no-questions-asked refund, ..."
        />
        {errors.refund_policy?.message ? (
          <p className="text-xs text-destructive">
            {errors.refund_policy.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
