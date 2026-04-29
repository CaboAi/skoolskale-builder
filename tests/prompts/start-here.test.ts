import { describe, expect, test } from 'vitest';
import { parseOutput } from '@/prompts/start-here';

const VALID = {
  step_1_how_to_use: {
    title: 'How to Use the Community',
    sections: [
      { name: 'Community tab', description: 'Announcements, Wins, Intros' },
      { name: 'Classroom', description: 'All courses and meditations' },
      { name: 'Calendar', description: 'All events under the calendar tab' },
    ],
  },
  step_2_community_rules: {
    title: 'Community Rules',
    rules: [
      'Be kind and supportive.',
      'No self-promotion in posts.',
      'Keep it spam-free.',
    ],
  },
  step_3_faqs: [
    {
      question: "Where do I start?",
      answer_template:
        "Head to Classroom and begin with the foundational module. Follow your curiosity.",
    },
    {
      question: "Is there a content order?",
      answer_template:
        "Not strictly. Start where you feel most drawn; this community is self-paced.",
    },
    {
      question: "Are events recorded?",
      answer_template:
        "Yes — every live session is uploaded to Classroom within 24 hours.",
    },
    {
      question: "How do I level up?",
      answer_template:
        "Engage: comment, share wins, support others. Each action earns points.",
    },
  ],
  step_4_need_assistance: {
    title: 'Need Assistance?',
    template: 'Contact {support_contact} or email {support_email}.',
  },
};

describe('start-here.parseOutput', () => {
  test('parses a complete 4-step document', () => {
    const raw = `<start_here_json>
${JSON.stringify(VALID, null, 2)}
</start_here_json>`;
    const out = parseOutput(raw);
    expect(out.step_1_how_to_use.sections).toHaveLength(3);
    expect(out.step_3_faqs).toHaveLength(4);
    expect(out.step_4_need_assistance.template).toMatch(/support_contact/);
  });

  test('throws when tag is missing', () => {
    expect(() => parseOutput('nope')).toThrow(/missing <start_here_json>/);
  });

  test('throws when fewer than 4 FAQs', () => {
    const thin = { ...VALID, step_3_faqs: VALID.step_3_faqs.slice(0, 3) };
    const raw = `<start_here_json>${JSON.stringify(thin)}</start_here_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });

  test('throws when step_1 has fewer than 3 sections', () => {
    const thin = {
      ...VALID,
      step_1_how_to_use: {
        ...VALID.step_1_how_to_use,
        sections: VALID.step_1_how_to_use.sections.slice(0, 2),
      },
    };
    const raw = `<start_here_json>${JSON.stringify(thin)}</start_here_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });

  test('throws on invalid JSON', () => {
    const raw = `<start_here_json>{ not json }</start_here_json>`;
    expect(() => parseOutput(raw)).toThrow(/invalid JSON/);
  });

  // Regression: Sprint 3 live E2E run produced these exact drift shapes.
  // The fix is in the prompt (explicit JSON skeleton), so the schema
  // continues to reject these — these tests guard the schema contract.
  test('rejects step_1_how_to_use with missing sections array', () => {
    const drift = {
      ...VALID,
      step_1_how_to_use: { title: 'How to Use the Community' },
    };
    const raw = `<start_here_json>${JSON.stringify(drift)}</start_here_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });

  test('rejects step_3_faqs returned as an object instead of array', () => {
    const drift = {
      ...VALID,
      step_3_faqs: {
        'Where do I start?': 'Head to Classroom.',
        'Is there an order?': 'No, self-paced.',
        'Are events recorded?': 'Yes, within 24 hours.',
        'How do I level up?': 'Engage and earn points.',
      },
    };
    const raw = `<start_here_json>${JSON.stringify(drift)}</start_here_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });

  test('rejects step_4_need_assistance returned as a bare string', () => {
    const drift = {
      ...VALID,
      step_4_need_assistance: 'Contact support@example.com if you need help.',
    };
    const raw = `<start_here_json>${JSON.stringify(drift)}</start_here_json>`;
    expect(() => parseOutput(raw)).toThrow(/schema mismatch/);
  });
});
