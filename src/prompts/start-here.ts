import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';
import { listedPerks, regenerateNoteSuffix } from './_shared';

const HowToUseSectionSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
});

const PerkSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
});

export const START_HERE_PERKS_MAX = 20;

const FaqSchema = z.object({
  question: z.string().min(3).max(250),
  answer_template: z.string().min(10).max(2000),
});

export const StartHereSchema = z.object({
  step_1_how_to_use: z.object({
    title: z.string().min(1).max(120),
    sections: z.array(HowToUseSectionSchema).min(3).max(10),
  }),
  step_2_community_rules: z.object({
    title: z.string().min(1).max(120),
    rules: z.array(z.string().min(3).max(300)).min(3).max(10),
  }),
  step_3_faqs: z.array(FaqSchema).min(4).max(10),
  step_4_need_assistance: z.object({
    title: z.string().min(1).max(120),
    template: z.string().min(5).max(500),
  }),
  /**
   * Present only when the intake lists perks (offer_breakdown.perks). Sits
   * after Need Assistance so it renders as the last Start Here lesson.
   * Optional so assets generated before this step existed still parse.
   */
  step_5_perks: z
    .object({
      title: z.string().min(1).max(120),
      perks: z.array(PerkSchema).min(1).max(START_HERE_PERKS_MAX),
    })
    .optional(),
});

export type StartHereOutput = z.infer<typeof StartHereSchema>;

export const systemPrompt = `You are a community operations writer. You produce the "Start Here" onboarding document for a Skool community — what members read first.

The output is a 4-step structured JSON document, plus a 5th "perks" step ONLY when the creator has perks. Steps 1-4 are REQUIRED. Match this exact shape:

{
  "step_1_how_to_use": {
    "title": "string (1-120 chars, e.g. 'How to Use the Community')",
    "sections": [
      { "name": "string (1-80 chars, tab/feature name)", "description": "string (1-400 chars, what's there)" }
      // 3 to 10 section objects, ALWAYS an array, never an object map
    ]
  },
  "step_2_community_rules": {
    "title": "string (1-120 chars, e.g. 'Community Rules')",
    "rules": [
      "string (3-300 chars, short imperative)"
      // 3 to 10 rule strings, ALWAYS an array of strings
    ]
  },
  "step_3_faqs": [
    { "question": "string (3-250 chars)", "answer_template": "string (10-2000 chars)" }
    // 4 to 10 FAQ objects, ALWAYS an array (NOT an object keyed by question)
  ],
  "step_4_need_assistance": {
    "title": "string (1-120 chars, e.g. 'Need Assistance?')",
    "template": "string (5-500 chars, closing line that names the support contact)"
  },
  "step_5_perks": {
    "title": "string (1-120 chars, e.g. 'Your Member Perks')",
    "perks": [
      { "name": "string (1-80 chars, the perk)", "description": "string (1-400 chars, what the member gets + why it matters)" }
      // one object per perk listed in the creator's offer_breakdown.perks, same order
    ]
  }
}

Shape rules (these are the most common drift points — read carefully):
- step_1_how_to_use is an OBJECT with "title" (string) and "sections" (array of {name, description}). It is NOT a bare array.
- step_2_community_rules is an OBJECT with "title" (string) and "rules" (array of plain strings). Rules are strings, not objects.
- step_3_faqs is an ARRAY of objects, each {question, answer_template}. It is NOT an object whose keys are questions.
- step_4_need_assistance is an OBJECT with "title" (string) and "template" (string). It is NOT a bare string.
- step_1 through step_4 MUST be present. Do not omit any of them.
- step_5_perks is an OBJECT with "title" (string) and "perks" (array of {name, description}). Include it ONLY when the task says the creator has perks; otherwise omit the key entirely.

Content rules:
- Use the creator's tone for rule phrasing and FAQ answers. Per-tone calibration:
    - "warm": nurturing, inclusive ("we / together / here for"). Avoid spiritual-influencer banlist (sacred, beloved, dear one).
    - "direct": no fluff. Imperative, single-clause rules.
    - "playful": light wordplay; emojis off.
    - "authoritative": expert, declarative. Frame rules as standards, not requests.
    - "inspirational": vision-forward — tie rules and FAQs back to the transformation when natural.
    - "bold": high-energy, declarative. Short rules, strong verbs, no hedging.
- step_1 sections explain the Skool tabs (Community, Classroom, Calendar, Networking, Map, Leaderboard, Chat, Events) and any creator-specific features mentioned in the offer breakdown.
- step_3_faqs MUST address at minimum: where to start, content order, event recordings, leveling up. You may add more relevant FAQs.
- step_4 template MUST reference the creator's support_contact value (use the literal value from creator context).
- step_5_perks: one entry per perk the creator listed, in the same order. Keep the perk's substance — rephrase the name only for clarity, never invent new perks, discounts, values, or redemption mechanics. The description says what the member gets, in the creator's tone.
- Do not invent offers, prices, or community features absent from the creator context.

Output rules:
- Wrap the JSON in <start_here_json>...</start_here_json> tags.
- No preamble, no commentary, no markdown fences inside the tags.

Respond in this exact format:
<start_here_json>
{ ...JSON object matching the shape above... }
</start_here_json>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${JSON.stringify(ex.raw, null, 2)}
</example_${i + 1}>`,
    )
    .join('\n\n');

  return `<examples>
${examples || '<!-- no examples available -->'}
</examples>

<creator_context>
Creator name: ${input.creator.name}
Community name: ${input.creator.community_name}
Niche: ${input.creator.niche}
Audience: ${input.creator.audience}
Transformation: ${input.creator.transformation}
Tone: ${input.creator.tone}
Offer breakdown: ${JSON.stringify(input.creator.offer_breakdown)}
Support contact: ${input.creator.support_contact}
Brand prefs: ${input.creator.brand_prefs || '(none)'}
</creator_context>

<task>
Write the Start Here document in a ${input.creator.tone} tone. Output only the JSON inside the <start_here_json> tags.

${perksInstruction(listedPerks(input.creator.offer_breakdown))}

Reminder of required shape — steps 1-4 must be present:
- step_1_how_to_use: { title, sections: [...] }       (object, not array)
- step_2_community_rules: { title, rules: [...] }     (object, not array)
- step_3_faqs: [ { question, answer_template }, ... ] (array, not object)
- step_4_need_assistance: { title, template }         (object, not string)
- step_5_perks: { title, perks: [...] }                (object, only when the creator has perks)
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

function perksInstruction(perks: string[]): string {
  if (perks.length === 0) {
    return 'The creator has NO perks. OMIT step_5_perks entirely.';
  }
  const list = perks.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return `The creator HAS perks. INCLUDE step_5_perks with exactly ${perks.length} entries, one per perk below, in this order:\n${list}`;
}

/**
 * With the intake available, step 5 is reconciled against it: a perks
 * creator must get step_5_perks (throwing lets Inngest retry), and a stray
 * step 5 for a no-perks creator is dropped rather than shipped.
 */
export function parseOutput(
  raw: string,
  input?: GeneratorInput,
): StartHereOutput {
  const match = raw.match(/<start_here_json>([\s\S]*?)<\/start_here_json>/i);
  if (!match) throw new Error('start_here: missing <start_here_json> tag');

  const jsonText = match[1].trim();
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(
      `start_here: invalid JSON — ${e instanceof Error ? e.message : 'parse error'}`,
    );
  }

  const result = StartHereSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `start_here: schema mismatch — ${JSON.stringify(result.error.flatten().fieldErrors)}`,
    );
  }
  if (!input) return result.data;

  const hasPerks = listedPerks(input.creator.offer_breakdown).length > 0;
  if (hasPerks && !result.data.step_5_perks) {
    throw new Error('start_here: creator has perks but step_5_perks is missing');
  }
  if (!hasPerks && result.data.step_5_perks) {
    const steps = { ...result.data };
    delete steps.step_5_perks;
    return steps;
  }
  return result.data;
}
