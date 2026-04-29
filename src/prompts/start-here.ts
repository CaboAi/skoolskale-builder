import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';

const HowToUseSectionSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
});

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
});

export type StartHereOutput = z.infer<typeof StartHereSchema>;

export const systemPrompt = `You are a community operations writer. You produce the "Start Here" onboarding document for a Skool community — what members read first.

The output is a 4-step structured JSON document. Every field is REQUIRED. Match this exact shape:

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
  }
}

Shape rules (these are the most common drift points — read carefully):
- step_1_how_to_use is an OBJECT with "title" (string) and "sections" (array of {name, description}). It is NOT a bare array.
- step_2_community_rules is an OBJECT with "title" (string) and "rules" (array of plain strings). Rules are strings, not objects.
- step_3_faqs is an ARRAY of objects, each {question, answer_template}. It is NOT an object whose keys are questions.
- step_4_need_assistance is an OBJECT with "title" (string) and "template" (string). It is NOT a bare string.
- Every one of the four top-level keys MUST be present. Do not omit any field.

Content rules:
- Use the creator's tone for rule phrasing and FAQ answers.
- step_1 sections explain the Skool tabs (Community, Classroom, Calendar, Networking, Map, Leaderboard, Chat, Events) and any creator-specific features mentioned in the offer breakdown.
- step_3_faqs MUST address at minimum: where to start, content order, event recordings, leveling up. You may add more relevant FAQs.
- step_4 template MUST reference the creator's support_contact value (use the literal value from creator context).
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
${input.regenerateNote ? `\n<regenerate_note>${input.regenerateNote}</regenerate_note>\n` : ''}
<task>
Write the Start Here document in a ${input.creator.tone} tone. Output only the JSON inside the <start_here_json> tags.

Reminder of required shape — all 4 top-level keys must be present:
- step_1_how_to_use: { title, sections: [...] }       (object, not array)
- step_2_community_rules: { title, rules: [...] }     (object, not array)
- step_3_faqs: [ { question, answer_template }, ... ] (array, not object)
- step_4_need_assistance: { title, template }         (object, not string)
</task>`;
}

export function parseOutput(raw: string): StartHereOutput {
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
  return result.data;
}
