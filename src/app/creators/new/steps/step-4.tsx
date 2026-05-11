'use client';

import type { IntakeFormReturn } from '../wizard';
import type { CreatorIntake } from '@/types/schemas';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = { form: IntakeFormReturn };

type ToneOption = {
  value: CreatorIntake['tone'];
  label: string;
  description: string;
};

const TONES: readonly ToneOption[] = [
  {
    value: 'warm',
    label: 'Warm',
    description:
      'Nurturing, soft-edged, inclusive, comforting. Wellness, spiritual, women-led communities.',
  },
  {
    value: 'direct',
    label: 'Direct',
    description:
      'Concise, no-bullshit, gets to the point. Sales, productivity, business.',
  },
  {
    value: 'playful',
    label: 'Playful',
    description:
      'Energetic, witty, humor and lightness. Creative, hobby, lifestyle.',
  },
  {
    value: 'authoritative',
    label: 'Authoritative',
    description:
      'Expert, confident, commands the subject. Finance, B2B, professional development.',
  },
  {
    value: 'inspirational',
    label: 'Inspirational',
    description:
      'Uplifting, vision-driven, transformation language. Personal development, spirituality, life coaching.',
  },
  {
    value: 'bold',
    label: 'Bold',
    description:
      "High-energy, declarative, doesn't apologize. Fitness, entrepreneurship, athletic communities.",
  },
] as const;

export function Step4Voice({ form }: Props) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const tone = watch('tone');
  const selected = TONES.find((t) => t.value === tone);

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-medium">Voice &amp; brand</h2>

      <div className="space-y-1.5">
        <Label htmlFor="tone">Tone</Label>
        <Select
          value={tone}
          onValueChange={(v) =>
            setValue('tone', v as CreatorIntake['tone'], {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger id="tone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[420px] max-w-[calc(100vw-2rem)]">
            {TONES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground whitespace-normal">
                    {t.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected ? (
          <p className="text-xs text-muted-foreground">{selected.description}</p>
        ) : null}
        {errors.tone?.message ? (
          <p className="text-xs text-destructive">{errors.tone.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brand_prefs">Brand preferences</Label>
        <Textarea
          id="brand_prefs"
          rows={5}
          {...register('brand_prefs')}
          placeholder="Colors, typography vibes, visual references, words to use / avoid…"
        />
        {errors.brand_prefs?.message ? (
          <p className="text-xs text-destructive">
            {errors.brand_prefs.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
