import { describe, expect, test } from 'vitest';
import {
  parseOutput,
  systemPrompt,
  buildUserMessage,
  AboutUsSchema,
  ABOUT_US_MAX_CHARS,
  ABOUT_US_TARGET_MIN,
} from '@/prompts/about-us';
import { renderAboutUsText } from '@/lib/modules/render';
import { CapViolationError } from '@/lib/inngest/cap-violation';
import type { GeneratorInput } from '@/types/generators';

// Rendered length: ~720 chars — well inside the 1,050 cap with the new
// one-line-per-bucket structure.
const VALID = {
  hero: 'Reclaim your power and rebuild your inner authority — for women ready to do the real work.',
  trial_callout: '7-day free trial. Cancel anytime in the first week.',
  value_buckets: [
    {
      emoji: '💜',
      header: 'COURSES',
      items: ['Self-led modules on identity, abundance, and embodied healing — go at your pace.'],
    },
    {
      emoji: '💜',
      header: 'COACHING',
      items: ['Weekly group coaching and a monthly mastermind Q&A with Sianna.'],
    },
    {
      emoji: '💜',
      header: 'PERKS',
      items: ['Past call recordings, monthly guest teachers, and access to live Sanctuary events.'],
    },
  ],
  pricing: '$67/month or $513/year (save 36%).',
  refund_policy: 'Full refund within 14 days, no questions asked.',
};

const MINIMAL_INPUT: GeneratorInput = {
  creator: {
    name: 'Sianna',
    community_name: 'Sanctuary',
    niche: 'spiritual',
    audience: 'soul-led women',
    transformation: 'reclaim power',
    tone: 'warm',
    offer_breakdown: { perks: [], guest_sessions: false },
    pricing: { additional_tiers: [] },
    trial_terms: { has_trial: true, duration_days: 7 },
    refund_policy: '14-day refund.',
    support_contact: 'Ramsha A.',
    brand_prefs: '',
  },
  patternLibrary: [],
};

describe('about-us', () => {
  describe('parseOutput', () => {
    test('parses valid JSON inside tags', () => {
      const raw = `Some preamble text.
<about_us_json>
${JSON.stringify(VALID, null, 2)}
</about_us_json>
Trailing text.`;

      const out = parseOutput(raw);
      expect(out.hero).toBe(VALID.hero);
      expect(out.value_buckets).toHaveLength(3);
      expect(out.value_buckets[0].items).toHaveLength(1);
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

    test('throws when value_buckets has more than 3 buckets', () => {
      const tooMany = {
        ...VALID,
        value_buckets: [
          ...VALID.value_buckets,
          { emoji: '💜', header: 'EXTRA', items: ['One extra.'] },
        ],
      };
      const raw = `<about_us_json>${JSON.stringify(tooMany)}</about_us_json>`;
      expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
    });

    test('throws when a bucket has more than 1 item (multi-line bodies forbidden)', () => {
      const multiItem = {
        ...VALID,
        value_buckets: [
          { emoji: '💜', header: 'COURSES', items: ['Line one.', 'Line two.'] },
          ...VALID.value_buckets.slice(1),
        ],
      };
      const raw = `<about_us_json>${JSON.stringify(multiItem)}</about_us_json>`;
      expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
    });

    test('throws CapViolationError when rendered length exceeds the cap', () => {
      // Pad bucket lines (each capped at 140) to push the rendered total
      // past 1,050 without violating per-field maxes individually.
      const padded = {
        ...VALID,
        hero: 'a'.repeat(240),
        trial_callout: 'b'.repeat(160),
        value_buckets: [
          { emoji: '💜', header: 'COURSES', items: ['c'.repeat(140)] },
          { emoji: '💜', header: 'COACHING', items: ['d'.repeat(140)] },
          { emoji: '💜', header: 'PERKS', items: ['e'.repeat(140)] },
        ],
        pricing: 'f'.repeat(160),
        refund_policy: 'g'.repeat(220),
      };
      const raw = `<about_us_json>${JSON.stringify(padded)}</about_us_json>`;

      let caught: unknown;
      try {
        parseOutput(raw);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(CapViolationError);
      const err = caught as CapViolationError;
      expect(err.module).toBe('about_us');
      expect(err.maxChars).toBe(ABOUT_US_MAX_CHARS);
      expect(err.actualChars).toBeGreaterThan(ABOUT_US_MAX_CHARS);
      expect(err.message).toMatch(
        new RegExp(`About Us is \\d+ chars \\(cap: ${ABOUT_US_MAX_CHARS}\\)`),
      );
    });
  });

  describe('AboutUsSchema (.superRefine)', () => {
    test('accepts a rendered payload under the cap', () => {
      expect(AboutUsSchema.safeParse(VALID).success).toBe(true);
    });

    test('rejects a payload whose rendered length is over the cap', () => {
      const oversized = {
        ...VALID,
        hero: 'a'.repeat(240),
        trial_callout: 'b'.repeat(160),
        value_buckets: [
          { emoji: '💜', header: 'COURSES', items: ['c'.repeat(140)] },
          { emoji: '💜', header: 'COACHING', items: ['d'.repeat(140)] },
          { emoji: '💜', header: 'PERKS', items: ['e'.repeat(140)] },
        ],
        pricing: 'f'.repeat(160),
        refund_policy: 'g'.repeat(220),
      };
      const result = AboutUsSchema.safeParse(oversized);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes(`cap: ${ABOUT_US_MAX_CHARS}`),
          ),
        ).toBe(true);
      }
    });
  });

  describe('renderAboutUsText helper', () => {
    test('single-item buckets render without a "- " prefix', () => {
      const text = renderAboutUsText(VALID);
      expect(text).toContain('💜 COURSES\nSelf-led modules');
      expect(text).not.toMatch(/^- /m);
    });

    test('legacy multi-item buckets still render with bullet prefixes', () => {
      const legacy = {
        ...VALID,
        value_buckets: [
          { emoji: '💜', header: 'COURSES', items: ['A', 'B'] },
        ],
      };
      const text = renderAboutUsText(legacy);
      expect(text).toContain('💜 COURSES\n- A\n- B');
    });
  });

  describe('systemPrompt', () => {
    test('includes the char-count constraint', () => {
      expect(systemPrompt).toContain(`${ABOUT_US_MAX_CHARS}`);
      expect(systemPrompt).toMatch(
        /Count characters before outputting/i,
      );
      expect(systemPrompt).toMatch(/Maximum 3 value buckets/);
      expect(systemPrompt).toMatch(/No bullet lists inside buckets/);
    });
  });

  describe('buildUserMessage', () => {
    test('threads the target band (min + max) into the task line', () => {
      const msg = buildUserMessage(MINIMAL_INPUT);
      expect(msg).toContain(`${ABOUT_US_TARGET_MIN}-${ABOUT_US_MAX_CHARS} characters`);
      expect(msg).toContain('2-3 value_buckets');
    });

    test('appends the regenerate note as a priority-framed suffix when present', () => {
      const msg = buildUserMessage({
        ...MINIMAL_INPUT,
        regenerateNote: 'make it longer',
      });
      expect(msg).toContain('USER FEEDBACK TO INCORPORATE');
      expect(msg).toContain('make it longer');
      // Suffix lands after the task block so it stays weighted last.
      expect(msg.indexOf('make it longer')).toBeGreaterThan(msg.indexOf('</task>'));
    });

    test('omits the suffix entirely when no note is supplied', () => {
      const msg = buildUserMessage(MINIMAL_INPUT);
      expect(msg).not.toContain('USER FEEDBACK TO INCORPORATE');
    });
  });
});
