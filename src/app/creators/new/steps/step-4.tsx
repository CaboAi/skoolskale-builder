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

const TONES = ['loving', 'direct', 'playful'] as const;

export function Step4Voice({ form }: Props) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const tone = watch('tone');

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
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
