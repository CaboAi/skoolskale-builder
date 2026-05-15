'use client';

import type { IntakeFormReturn } from '../wizard';
import type { CreatorIntake } from '@/types/schemas';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type Props = { form: IntakeFormReturn };

const TIER_ORDER = ['Premium', 'VIP'] as const;
type TierName = (typeof TIER_ORDER)[number];

export function Step3Pricing({ form }: Props) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const pricing = watch('pricing');
  const trial = watch('trial_terms');
  const additionalTiers = pricing.additional_tiers ?? [];

  const setTiers = (
    tiers: CreatorIntake['pricing']['additional_tiers'],
  ) =>
    setValue('pricing.additional_tiers', tiers, {
      shouldDirty: true,
      shouldValidate: true,
    });

  // Order invariant: Premium first, VIP only with Premium present. Adding the
  // next tier picks the next name in TIER_ORDER. Removing Premium cascades to
  // VIP so the array can never carry a lone VIP — matches the schema refine.
  const nextTierName: TierName | null =
    additionalTiers.length < TIER_ORDER.length
      ? TIER_ORDER[additionalTiers.length]
      : null;

  function addNextTier() {
    if (!nextTierName) return;
    setTiers([...additionalTiers, { name: nextTierName, price: '' }]);
  }

  function removeTierAt(i: number) {
    // Removing Premium (i=0) drops everything after it (cascade); removing VIP
    // (i=1) just pops the last row. Both reduce to "keep the first i rows".
    setTiers(additionalTiers.slice(0, i));
  }

  function setTierPrice(i: number, price: string) {
    const next = additionalTiers.map((row, idx) =>
      idx === i ? { ...row, price } : row,
    );
    setTiers(next);
  }

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

      {/* Additional tiers — locked Premium / VIP labels */}
      <div className="space-y-2">
        <Label>Additional tiers (optional)</Label>
        {additionalTiers.map((tier, i) => {
          const priceId = `tier-${tier.name.toLowerCase()}-price`;
          return (
            <div key={tier.name} className="flex items-center gap-2">
              <span
                className="inline-flex h-9 min-w-[80px] items-center justify-center rounded-md border bg-muted px-3 text-sm font-medium"
                aria-label={`${tier.name} tier`}
              >
                {tier.name}
              </span>
              <Input
                id={priceId}
                value={tier.price}
                onChange={(e) => setTierPrice(i, e.target.value)}
                placeholder="Price (text)"
                aria-label={`${tier.name} price`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => removeTierAt(i)}
              >
                Remove
              </Button>
            </div>
          );
        })}
        {nextTierName ? (
          <Button type="button" variant="outline" onClick={addNextTier}>
            Add {nextTierName} tier
          </Button>
        ) : null}
        {additionalTiers.length === 1 ? (
          <p className="text-xs text-muted-foreground">
            Removing Premium will also remove VIP — tiers must stay in order.
          </p>
        ) : null}
      </div>

      {/* Trial */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            {...register('trial_terms.has_trial')}
            className="size-4"
          />
          Offers a 7-day trial
        </label>
        {trial.has_trial ? (
          <p className="text-xs text-muted-foreground">
            All trials are 7 days.
          </p>
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
