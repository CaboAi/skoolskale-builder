import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';

export const TransformationSchema = z.object({
  candidates: z
    .array(z.string().min(1))
    .length(3, 'Must produce exactly 3 tagline candidates'),
});

export type TransformationOutput = z.infer<typeof TransformationSchema>;

const MIN_WORDS = 6;
const MAX_WORDS = 12;

export const systemPrompt = `You are a brand copywriter specializing in community positioning lines (taglines) for Skool communities.

Your job is to produce THREE distinct tagline candidates. Each tagline must:
- Be 6-12 words long (inclusive).
- Capture the promised transformation in the creator's voice.
- Stand alone — no trailing punctuation beyond a single period if needed.
- Match the tone provided in the creator context.
- Feel like a hook on a sales page, not a mission statement.

Hard rules:
- Exactly 3 candidates. Not more, not fewer.
- Each candidate is a single line.
- No emojis unless tone is "playful".
- No preamble, no explanation.

Respond in this exact format:
<taglines>
<tagline>First candidate here</tagline>
<tagline>Second candidate here</tagline>
<tagline>Third candidate here</tagline>
</taglines>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} source="${ex.sourceCreator ?? 'universal'}">
${ex.content}
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
Transformation promise: ${input.creator.transformation}
Tone: ${input.creator.tone}
</creator_context>
${input.regenerateNote ? `\n<regenerate_note>${input.regenerateNote}</regenerate_note>\n` : ''}
<task>
Write 3 candidate taglines for this community in a ${input.creator.tone} tone. Each tagline: 6-12 words, captures the transformation, distinct from the other two.
</task>`;
}

export function parseOutput(raw: string): TransformationOutput {
  const outer = raw.match(/<taglines>([\s\S]*?)<\/taglines>/i);
  if (!outer) throw new Error('transformation: missing <taglines> tag');

  const inner = outer[1];
  const matches = [...inner.matchAll(/<tagline>([\s\S]*?)<\/tagline>/gi)].map(
    (m) => m[1].trim(),
  );

  if (matches.length !== 3) {
    throw new Error(
      `transformation: expected 3 candidates, got ${matches.length}`,
    );
  }

  for (const [i, c] of matches.entries()) {
    if (!c) throw new Error(`transformation: candidate ${i + 1} is empty`);
    const words = c.split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS || words > MAX_WORDS) {
      throw new Error(
        `transformation: candidate ${i + 1} word count ${words} out of range (${MIN_WORDS}-${MAX_WORDS})`,
      );
    }
  }

  return TransformationSchema.parse({ candidates: matches });
}
