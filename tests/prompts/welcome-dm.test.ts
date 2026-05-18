import { describe, expect, test } from 'vitest';
import {
  parseOutput,
  buildUserMessage,
  systemPrompt,
  WelcomeDmSchema,
  WELCOME_DM_MAX_CHARS,
} from '@/prompts/welcome-dm';
import { CapViolationError } from '@/lib/inngest/cap-violation';
import type { GeneratorInput } from '@/types/generators';

// Realistic warm-tone DM at 248 chars (well inside the 275-char cap).
// Counted: 248. Contains both merge tags verbatim.
const GOOD_DM = `Welcome in, #NAME# — so glad you found us at #GROUPNAME#. Take a breath, then open Classroom > Start Here. It walks you through the first move, the rhythm of our calls, and the way we engage here. Pace it on your own time. See you inside.`;

const MINIMAL_INPUT: GeneratorInput = {
  creator: {
    name: 'Sianna',
    community_name: 'Sanctuary',
    niche: 'spiritual',
    audience: 'soul-led women',
    transformation: 'reclaim power',
    tone: 'warm',
    offer_breakdown: {
      perks: [],
      guest_sessions: false,
    },
    pricing: { additional_tiers: [] },
    trial_terms: { has_trial: false, duration_days: 7 },
    refund_policy: '',
    support_contact: 'Ramsha A.',
    brand_prefs: '',
  },
  patternLibrary: [
    {
      tone: 'warm',
      niche: 'spiritual',
      sourceCreator: 'Test',
      content: 'namaste',
      raw: { text: 'namaste' },
    },
  ],
};

describe('welcome-dm', () => {
  describe('parseOutput', () => {
    test('parses a valid DM with required merge tags under the char cap', () => {
      const raw = `Here you go!
<welcome_dm>
${GOOD_DM}
</welcome_dm>
(done)`;

      const out = parseOutput(raw);
      expect(out.content).toContain('#NAME#');
      expect(out.content).toContain('#GROUPNAME#');
      expect(out.content.length).toBeLessThanOrEqual(WELCOME_DM_MAX_CHARS);
    });

    test('throws when <welcome_dm> tags are missing', () => {
      expect(() => parseOutput('just a bare DM without tags')).toThrow(
        /missing <welcome_dm>/,
      );
    });

    test('throws when #NAME# is missing', () => {
      const raw = `<welcome_dm>Welcome to #GROUPNAME# — open Classroom > Start Here.</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/#NAME#/);
    });

    test('throws when #GROUPNAME# is missing', () => {
      const raw = `<welcome_dm>Hi #NAME# — open Classroom > Start Here.</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/#GROUPNAME#/);
    });

    test('throws CapViolationError when content exceeds the cap', () => {
      // 320 chars including the merge tags — over 275.
      const overCap =
        'Hi #NAME#, welcome to #GROUPNAME#! ' +
        'x'.repeat(300);
      const raw = `<welcome_dm>${overCap}</welcome_dm>`;
      let caught: unknown;
      try {
        parseOutput(raw);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(CapViolationError);
      const err = caught as CapViolationError;
      expect(err.module).toBe('welcome_dm');
      expect(err.maxChars).toBe(WELCOME_DM_MAX_CHARS);
      expect(err.actualChars).toBeGreaterThan(WELCOME_DM_MAX_CHARS);
      expect(err.message).toMatch(
        new RegExp(`Welcome DM is \\d+ chars \\(cap: ${WELCOME_DM_MAX_CHARS}\\)`),
      );
    });

    test('throws on unexpected merge tags', () => {
      const raw = `<welcome_dm>Hi #NAME#, welcome to #GROUPNAME# — ping #SUPPORT_NAME#.</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/unexpected merge tags/);
    });
  });

  describe('WelcomeDmSchema (refine)', () => {
    test('rejects content over the char cap', () => {
      const result = WelcomeDmSchema.safeParse({
        content: 'a'.repeat(WELCOME_DM_MAX_CHARS + 1),
      });
      expect(result.success).toBe(false);
    });

    test('accepts content at or under the cap', () => {
      expect(
        WelcomeDmSchema.safeParse({ content: GOOD_DM }).success,
      ).toBe(true);
      expect(
        WelcomeDmSchema.safeParse({
          content: 'a'.repeat(WELCOME_DM_MAX_CHARS),
        }).success,
      ).toBe(true);
    });
  });

  describe('systemPrompt', () => {
    test('includes the char-count constraint', () => {
      expect(systemPrompt).toContain(`${WELCOME_DM_MAX_CHARS}`);
      expect(systemPrompt).toMatch(/INCLUDING the merge tags #NAME# and #GROUPNAME#/);
      expect(systemPrompt).toMatch(/Count characters before outputting/);
    });

    test('mentions all calibrated tones', () => {
      for (const tone of [
        'warm',
        'direct',
        'playful',
        'authoritative',
        'inspirational',
        'bold',
      ] as const) {
        expect(systemPrompt).toContain(`"${tone}"`);
      }
    });
  });

  describe('buildUserMessage', () => {
    test('includes tone, community name, and the example block', () => {
      const msg = buildUserMessage(MINIMAL_INPUT);
      expect(msg).toContain('Tone: warm');
      expect(msg).toContain('Sanctuary');
      expect(msg).toContain('<examples>');
      expect(msg).toContain('namaste');
    });

    test('threads the char target into the task line', () => {
      const msg = buildUserMessage(MINIMAL_INPUT);
      expect(msg).toContain(`${WELCOME_DM_MAX_CHARS} characters`);
    });

    test('appends USER FEEDBACK suffix when regenerateNote is provided', () => {
      const msg = buildUserMessage({
        ...MINIMAL_INPUT,
        regenerateNote: 'less flowery',
      });
      expect(msg).toContain('USER FEEDBACK TO INCORPORATE:\nless flowery');
      expect(msg.endsWith('the user feedback wins.')).toBe(true);
    });

    test('omits USER FEEDBACK suffix when regenerateNote is absent', () => {
      const msg = buildUserMessage(MINIMAL_INPUT);
      expect(msg).not.toContain('USER FEEDBACK TO INCORPORATE');
    });

    test.each(['authoritative', 'inspirational', 'bold'] as const)(
      'threads %s tone into the user message',
      (tone) => {
        const msg = buildUserMessage({
          ...MINIMAL_INPUT,
          creator: { ...MINIMAL_INPUT.creator, tone },
        });
        expect(msg).toContain(`Tone: ${tone}`);
        expect(msg).toContain(`in a ${tone} tone`);
      },
    );
  });
});
