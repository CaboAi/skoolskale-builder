import { z } from 'zod';
import type { GeneratorInput } from '@/types/generators';
import { regenerateNoteSuffix } from './_shared';

export const WelcomeDmSchema = z.object({
  content: z.string().min(50),
});

export type WelcomeDmOutput = z.infer<typeof WelcomeDmSchema>;

export const systemPrompt = `You are a specialist copywriter for Skool communities, trained on Skool Skale's voice and tone.

Your job is to write Welcome DMs that new community members receive immediately after joining. These DMs:
- Address the member by name using the #NAME# merge tag
- Name the community using the #GROUPNAME# merge tag
- Direct the member to Classroom > Start Here
- Name the support contact
- Match the creator's chosen tone exactly

Hard rules:
- Every DM MUST contain both "#NAME#" and "#GROUPNAME#" verbatim.
- No other merge tags.
- Length must be between 80 and 120 words (inclusive).
- No emojis unless the tone is "playful".
- No preamble, no explanation, no commentary — only the DM text inside the output tags.

Voice calibration (critical):
- Match the warmth level of the pattern examples EXACTLY. Do not amplify beyond them.
- Restraint reads as more authentic than abundance of affection. One understated beat beats three earnest ones.
- Per-tone calibration:
    - "warm": nurturing, grounded, inclusive. Reference ceiling — Sianna's "You've arrived in the sanctuary. Begin in Classroom > Start Here — this will gently guide you into the rhythm of this space." Comforting and specific, NOT effusive. Use "you'll find / we / together / here for you" not love-language.
    - "direct": no preamble, no warmth padding. Greet, point to Classroom > Start Here, name the support contact, done.
    - "playful": one light beat is fine; concrete details still required. Emojis allowed but max one.
    - "authoritative": confident, expert register. State what's here and what to do first as facts, not invitations. No hedging ("you might want to" — instead "start in Classroom > Start Here").
    - "inspirational": vision-forward — connect the welcome to the transformation promise. "imagine / step into / what becomes possible" register. Don't lapse into generic motivational copy.
    - "bold": high-energy declarative. Short punchy sentences, strong verbs, direct address. No "perhaps / maybe / might". One exclamation point max.
- Banned phrases for "warm" tone (unless they appear verbatim in the pattern examples you're given):
    "sacred space", "held space", "hold space", "beloved", "dear one",
    "with love and light", "soul sister", "soul family", "divine timing",
    "you are seen", "you belong here", "radiant being", "precious soul",
    "journey home", "come home", "open your heart", "soft landing",
    "warm embrace", "gentle embrace", "tender welcome".
- Prefer concrete, sensory, community-specific language over generic spiritual-influencer register.

Length discipline (non-negotiable):
- Target 90-110 words. This is a HARD requirement, not a suggestion.
- Reach this length with CONCRETE specifics — name where to start (Classroom > Start Here), what the first experience will be like (e.g. the first module, the first live session's day/time), who to message for support, ONE specific detail about the community's rhythm (cadence of calls, cadence of content, how engagement is structured).
- Do NOT pad with generic warmth. If you find yourself writing another affirming sentence, STOP and add a concrete detail instead.
- Count your words before outputting. If below 85 or above 115, rewrite.
- The Sianna reference is the voice ceiling, not the length ceiling — stay restrained, but say more.

Respond in this exact format:
<welcome_dm>
...the DM text...
</welcome_dm>`;

export function buildUserMessage(input: GeneratorInput): string {
  const examples = input.patternLibrary
    .map(
      (ex, i) => `<example_${i + 1} tone="${ex.tone ?? 'universal'}">
${ex.content}
</example_${i + 1}>`,
    )
    .join('\n\n');

  return `<examples>
${examples || '<!-- no examples available; rely on the system prompt -->'}
</examples>

<creator_context>
Creator name: ${input.creator.name}
Community name: ${input.creator.community_name}
Support contact: ${input.creator.support_contact}
Tone: ${input.creator.tone}
Niche: ${input.creator.niche}
</creator_context>

<task>
Write a Welcome DM for this community in a ${input.creator.tone} tone. Stay between 80 and 120 words. Use #NAME# and #GROUPNAME# verbatim.
</task>${regenerateNoteSuffix(input.regenerateNote)}`;
}

/**
 * Parse the Welcome DM out of a Claude response.
 * Throws on structural errors; the caller (Inngest function) maps those to
 * a failed generation_job row.
 */
export function parseOutput(raw: string): WelcomeDmOutput {
  const match = raw.match(/<welcome_dm>([\s\S]*?)<\/welcome_dm>/i);
  if (!match) throw new Error('welcome_dm: missing <welcome_dm> tag');

  const content = match[1].trim();
  if (!content) throw new Error('welcome_dm: empty content');

  const words = content.split(/\s+/).filter(Boolean).length;
  if (words < 80 || words > 120) {
    throw new Error(`welcome_dm: word count ${words} out of range (80-120)`);
  }
  if (!content.includes('#NAME#')) {
    throw new Error('welcome_dm: missing #NAME# merge tag');
  }
  if (!content.includes('#GROUPNAME#')) {
    throw new Error('welcome_dm: missing #GROUPNAME# merge tag');
  }
  // No merge tags other than the two allowed.
  const stray = content.match(/#[A-Z_]+#/g)?.filter(
    (t) => t !== '#NAME#' && t !== '#GROUPNAME#',
  );
  if (stray && stray.length > 0) {
    throw new Error(`welcome_dm: unexpected merge tags ${stray.join(', ')}`);
  }

  return WelcomeDmSchema.parse({ content });
}
