import { describe, expect, test } from 'vitest';
import {
  EMPTY_PERKS_POST,
  PERKS_POST_BODY_MAX,
  PerksPostSchema,
  buildUserMessage,
  parseOutput,
} from '@/prompts/perks-post';
import {
  CapViolationError,
  EmptyIntakeError,
} from '@/lib/inngest/cap-violation';
import type { CreatorContext, GeneratorInput } from '@/types/generators';

const PERKS = ['Private podcast', 'Monthly hot seat'];
const TITLE = 'Your Golden Breadcrumbs perks 🎁';
const BODY =
  'Every perk here exists to help you find your next breadcrumb.\n\n🎧 Private podcast\nWeekly episodes only members hear.\n\n🔥 Monthly hot seat\nBring one question, get coached live.\n\nWhich perk will you use first? Tell us below.\n\nSee you inside — Nancy';

function makeInput(perks: string[]): GeneratorInput {
  const creator: CreatorContext = {
    name: 'Nancy',
    community_name: 'Golden Breadcrumbs',
    niche: 'spiritual',
    audience: 'people navigating hard seasons',
    transformation: 'find evidence that impossible things are possible',
    tone: 'warm',
    offer_breakdown: { perks, guest_sessions: false },
    pricing: { free_community: false, additional_tiers: [] },
    trial_terms: { has_trial: true, duration_days: 7 as const },
    refund_policy: '',
    support_contact: 'support@example.test',
    brand_prefs: '',
  };
  return { creator, patternLibrary: [] };
}

function wrap(post: unknown): string {
  return `<perks_post_json>${JSON.stringify(post)}</perks_post_json>`;
}

describe('perks-post.buildUserMessage', () => {
  test('lists every intake perk in order', () => {
    expect(buildUserMessage(makeInput(PERKS))).toContain(
      '<perks>\n1. Private podcast\n2. Monthly hot seat\n</perks>',
    );
  });

  test.each([
    ['no perks', []],
    ['blank-only perks', ['  ', '']],
  ])('%s → EmptyIntakeError carrying the empty post', (_label, perks) => {
    let caught: unknown;
    try {
      buildUserMessage(makeInput(perks));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EmptyIntakeError);
    expect((caught as EmptyIntakeError).emptyContent).toEqual({
      title: '',
      body: '',
    });
  });
});

describe('perks-post.parseOutput', () => {
  test('parses and trims title + body', () => {
    expect(parseOutput(wrap({ title: ` ${TITLE} `, body: `${BODY}\n` }))).toEqual({
      title: TITLE,
      body: BODY,
    });
  });

  test('throws when the tag is missing', () => {
    expect(() => parseOutput(BODY)).toThrow('missing <perks_post_json> tag');
  });

  test('throws on invalid JSON', () => {
    expect(() => parseOutput('<perks_post_json>{ nope }</perks_post_json>')).toThrow(
      /invalid JSON/,
    );
  });

  test('throws when the body is blank', () => {
    expect(() => parseOutput(wrap({ title: TITLE, body: '   ' }))).toThrow(
      'title and body must be non-empty',
    );
  });

  test('body one char over the cap throws CapViolationError for the retry', () => {
    const body = 'a'.repeat(PERKS_POST_BODY_MAX + 1);
    let caught: unknown;
    try {
      parseOutput(wrap({ title: TITLE, body }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CapViolationError);
    expect((caught as CapViolationError).actualChars).toBe(PERKS_POST_BODY_MAX + 1);
  });

  test('body exactly at the cap is accepted', () => {
    const body = 'a'.repeat(PERKS_POST_BODY_MAX);
    expect(parseOutput(wrap({ title: TITLE, body })).body).toHaveLength(
      PERKS_POST_BODY_MAX,
    );
  });
});

describe('PerksPostSchema (PATCH validation)', () => {
  test.each([
    ['empty no-perks post', EMPTY_PERKS_POST, true],
    ['filled post', { title: TITLE, body: BODY }, true],
    ['title without body', { title: TITLE, body: '' }, false],
    ['body without title', { title: '', body: BODY }, false],
  ])('%s → valid=%s', (_label, post, valid) => {
    expect(PerksPostSchema.safeParse(post).success).toBe(valid);
  });
});
