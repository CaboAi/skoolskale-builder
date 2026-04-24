import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/about-us';

const VALID = {
  hero: '🎟 OUR BIGGEST GIVEAWAY EVER: Join the community & be entered to win 5 FREE tickets to Hawaii Retreat (May 14-17)',
  trial_callout: '🎁 Limited Time 7-Day Free Trial.',
  value_buckets: [
    {
      emoji: '💜',
      header: 'COURSES',
      items: ['Skool Exclusive Course', 'Neville Goddard Teachings', 'Money & Abundance'],
    },
    {
      emoji: '💜',
      header: 'COACHING',
      items: ['Weekly group coaching call.', 'Weekly mastermind Q&A call.'],
    },
    {
      emoji: '💜',
      header: 'PERKS',
      items: [
        'Access all previous community call recordings.',
        'Monthly special guest speakers.',
      ],
    },
  ],
  pricing: 'Membership: $67 per month OR $513 per year (Save 36%)',
  refund_policy: 'Cancel anytime. Refund within 14 days of purchase.',
};

describe('about-us.parseOutput', () => {
  test('parses valid JSON inside tags', () => {
    const raw = `Some preamble text.
<about_us_json>
${JSON.stringify(VALID, null, 2)}
</about_us_json>
Trailing text.`;

    const out = parseOutput(raw);
    expect(out.hero).toBe(VALID.hero);
    expect(out.value_buckets).toHaveLength(3);
    expect(out.value_buckets[0].items).toContain('Skool Exclusive Course');
  });

  test('throws when the <about_us_json> tag is missing', () => {
    expect(() => parseOutput('plain text')).toThrow(/missing <about_us_json>/);
  });

  test('throws when JSON is malformed', () => {
    const raw = `<about_us_json>{ "hero": "H", broken }</about_us_json>`;
    expect(() => parseOutput(raw)).toThrow(/invalid JSON/);
  });

  test('throws when schema is missing a required field', () => {
    const missingPricing = { ...VALID } as Partial<typeof VALID>;
    delete missingPricing.pricing;
    const raw = `<about_us_json>${JSON.stringify(missingPricing)}</about_us_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });

  test('throws when value_buckets has fewer than 3 buckets', () => {
    const skinny = {
      ...VALID,
      value_buckets: [
        {
          emoji: '💜',
          header: 'COURSES',
          items: ['Item 1', 'Item 2'],
        },
        {
          emoji: '💜',
          header: 'PERKS',
          items: ['Item 1', 'Item 2'],
        },
      ],
    };
    const raw = `<about_us_json>${JSON.stringify(skinny)}</about_us_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });

  test('throws when a bucket has only 1 item (min 2 required)', () => {
    const stingy = {
      ...VALID,
      value_buckets: [
        { emoji: '💜', header: 'COURSES', items: ['Just one'] },
        { emoji: '💜', header: 'COACHING', items: ['A', 'B'] },
        { emoji: '💜', header: 'PERKS', items: ['A', 'B'] },
      ],
    };
    const raw = `<about_us_json>${JSON.stringify(stingy)}</about_us_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });
});
