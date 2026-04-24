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

The output is a 4-step structured document:
- step_1_how_to_use: titled section explaining the Skool tabs (Community, Classroom, Calendar, etc.) with 3-10 sub-sections.
- step_2_community_rules: titled section with 3-10 rules (short imperatives).
- step_3_faqs: 4-10 question/answer pairs. Answers match the creator's tone.
- step_4_need_assistance: titled section with a template closing line naming the support contact.

Hard rules:
- Output valid JSON inside <start_here_json>...</start_here_json> tags.
- Use the creator's tone for rule phrasing and FAQ answers.
- FAQs must address: where to start, content order, event recordings, leveling up. Additional FAQs are welcome.
- The step_4 template must reference the creator's support_contact value.
- Do not invent offers, prices, or community features absent from the creator context.

Respond in this exact format:
<start_here_json>
{ ... valid JSON object matching the schema ... }
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
