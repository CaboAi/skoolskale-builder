import { describe, expect, test } from 'vitest';
import { parseOutput, buildUserMessage } from '@/prompts/welcome-dm';
import type { GeneratorInput } from '@/types/generators';

const GOOD_DM = `Namaste #NAME# and welcome to #GROUPNAME#. You've arrived in a sanctuary held with deep intention — a place where you can remember who you really are. Take a breath. Begin in Classroom then Start Here, where the first gentle threshold waits for you. Move at the pace of your own becoming. Questions or wobbles? Reach out to Ramsha A. directly and she'll make sure you land softly. This space will meet you where you are and gently expand from there. So glad you're here — let the work begin.`;

const MINIMAL_INPUT: GeneratorInput = {
  creator: {
    name: 'Sianna',
    community_name: 'Sanctuary',
    niche: 'spiritual',
    audience: 'soul-led women',
    transformation: 'reclaim power',
    tone: 'loving',
    offer_breakdown: {
      courses: [],
      perks: [],
      events: [],
      guest_sessions: false,
    },
    pricing: { tiers: [] },
    trial_terms: { has_trial: false },
    refund_policy: '',
    support_contact: 'Ramsha A.',
    brand_prefs: '',
  },
  patternLibrary: [
    { tone: 'loving', niche: 'spiritual', sourceCreator: 'Test', content: 'namaste', raw: { text: 'namaste' } },
  ],
};

describe('welcome-dm', () => {
  describe('parseOutput', () => {
    test('parses a valid DM with required merge tags and 80-120 words', () => {
      const raw = `Here you go!
<welcome_dm>
${GOOD_DM}
</welcome_dm>
(done)`;

      const out = parseOutput(raw);
      expect(out.content).toContain('#NAME#');
      expect(out.content).toContain('#GROUPNAME#');
    });

    test('throws when <welcome_dm> tags are missing', () => {
      expect(() => parseOutput('just a bare DM without tags')).toThrow(
        /missing <welcome_dm>/,
      );
    });

    test('throws when #NAME# is missing', () => {
      const short = Array(90).fill('word').join(' ');
      const raw = `<welcome_dm>${short} welcome to #GROUPNAME#!</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/#NAME#/);
    });

    test('throws when #GROUPNAME# is missing', () => {
      const body = Array(88).fill('word').join(' ') + ' #NAME# welcome!';
      const raw = `<welcome_dm>${body}</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/#GROUPNAME#/);
    });

    test('throws on word count below 80', () => {
      const short = `Hey #NAME# welcome to #GROUPNAME# — start here, ping Ramsha if stuck.`;
      const raw = `<welcome_dm>${short}</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/word count/);
    });

    test('throws on word count above 120', () => {
      const big = Array(125).fill('word').join(' ') + ' #NAME# #GROUPNAME#';
      const raw = `<welcome_dm>${big}</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/word count/);
    });

    test('throws on unexpected merge tags', () => {
      const body =
        Array(90).fill('word').join(' ') +
        ' #NAME# #GROUPNAME# #SUPPORT_NAME#';
      const raw = `<welcome_dm>${body}</welcome_dm>`;
      expect(() => parseOutput(raw)).toThrow(/unexpected merge tags/);
    });
  });

  describe('buildUserMessage', () => {
    test('includes tone, community name, support contact, and the example block', () => {
      const msg = buildUserMessage(MINIMAL_INPUT);
      expect(msg).toContain('Tone: loving');
      expect(msg).toContain('Sanctuary');
      expect(msg).toContain('Ramsha A.');
      expect(msg).toContain('<examples>');
      expect(msg).toContain('namaste');
    });

    test('includes regenerate_note when provided', () => {
      const msg = buildUserMessage({
        ...MINIMAL_INPUT,
        regenerateNote: 'less flowery',
      });
      expect(msg).toContain('<regenerate_note>less flowery</regenerate_note>');
    });

    test('omits regenerate_note tag when absent', () => {
      const msg = buildUserMessage(MINIMAL_INPUT);
      expect(msg).not.toContain('<regenerate_note>');
    });
  });
});
