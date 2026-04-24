'use client';

import type { IntakeFormReturn } from '../wizard';
import type { CreatorIntake } from '@/types/schemas';

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

  const setCourses = (courses: CreatorIntake['offer_breakdown']['courses']) =>
    setValue('offer_breakdown.courses', courses, { shouldDirty: true });

  const setPerks = (perks: string[]) =>
    setValue('offer_breakdown.perks', perks, { shouldDirty: true });

  const setEvents = (events: string[]) =>
    setValue('offer_breakdown.events', events, { shouldDirty: true });

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

      {/* Courses */}
      <div className="space-y-2">
        <Label>Courses</Label>
        {offer.courses.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={c.name}
              onChange={(e) => {
                const next = [...offer.courses];
                next[i] = { ...next[i], name: e.target.value };
                setCourses(next);
              }}
              placeholder="Course name"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setCourses(offer.courses.filter((_, idx) => idx !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setCourses([...offer.courses, { name: '' }])}
        >
          Add course
        </Button>
      </div>

      {/* Live calls */}
      <div className="space-y-1.5">
        <Label htmlFor="live_calls">Live calls (cadence / format)</Label>
        <Input
          id="live_calls"
          {...register('offer_breakdown.live_calls')}
          placeholder="Weekly group calls, 60 min"
        />
      </div>

      {/* Perks */}
      <StringListField
        label="Perks"
        placeholder="Private podcast, community Q&A, ..."
        values={offer.perks}
        onChange={setPerks}
      />

      {/* Events */}
      <StringListField
        label="Events"
        placeholder="Quarterly retreat, monthly workshop, ..."
        values={offer.events}
        onChange={setEvents}
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
}: {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
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
      <Button type="button" variant="outline" onClick={() => onChange([...values, ''])}>
        Add {label.toLowerCase().replace(/s$/, '')}
      </Button>
    </div>
  );
}
