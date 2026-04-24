'use client';

import type { IntakeFormReturn } from '../wizard';
import type { CreatorIntake } from '@/types/schemas';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PhotoUpload } from '../photo-upload';

type Props = { form: IntakeFormReturn };

const NICHES = [
  'spiritual',
  'business',
  'fitness',
  'relationships',
  'money',
  'yoga',
  'other',
] as const;

export function Step1CreatorInfo({ form }: Props) {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const niche = watch('niche');
  const photoUrl = watch('creator_photo_url');

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Creator &amp; Community</h2>

      <FieldRow label="Creator name" error={errors.name?.message} htmlFor="name">
        <Input id="name" {...register('name')} placeholder="Jane Doe" />
      </FieldRow>

      <FieldRow
        label="Community name"
        error={errors.community_name?.message}
        htmlFor="community_name"
      >
        <Input
          id="community_name"
          {...register('community_name')}
          placeholder="Alchemy: Soul Sanctuary"
        />
      </FieldRow>

      <FieldRow label="Niche" error={errors.niche?.message} htmlFor="niche">
        <Select
          value={niche}
          onValueChange={(v) =>
            setValue('niche', v as CreatorIntake['niche'], {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger id="niche">
            <SelectValue placeholder="Select a niche" />
          </SelectTrigger>
          <SelectContent>
            {NICHES.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow
        label="Support contact"
        error={errors.support_contact?.message}
        htmlFor="support_contact"
      >
        <Input
          id="support_contact"
          {...register('support_contact')}
          placeholder="@handle or support@example.com"
        />
      </FieldRow>

      <FieldRow
        label="Creator photo (optional)"
        error={errors.creator_photo_url?.message}
      >
        <PhotoUpload
          value={photoUrl}
          onChange={(url) =>
            setValue('creator_photo_url', url, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        />
      </FieldRow>
    </section>
  );
}

function FieldRow({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
