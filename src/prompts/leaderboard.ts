import {
  LeaderboardContentSchema,
  type LeaderboardContent,
} from '@/types/schemas';
import type { GeneratorInput } from '@/types/generators';

const NUM_LEVELS = 9;
const LEVEL_MAX_CHARS = 30;

export const systemPrompt = `You are a brand copywriter naming the 9 leaderboard levels for a Skool community.

Skool's leaderboard has exactly 9 ranks members progress through as they earn engagement points. The names are visible everywhere a member appears in the community, so they need to:
- Be evocative of the niche and the transformation
- Read as a believable progression from "just joined" → "deeply established"
- Feel cohesive as a SET (all the same metaphor, same register)
- Match the creator's tone

Hard rules:
- Exactly ${NUM_LEVELS} level names. Not more, not fewer.
- Each name: 1-${LEVEL_MAX_CHARS} characters. No emojis. No numbering inside the name (we render "1." separately).
- Levels MUST progress from least-advanced (level 1) to most-advanced (level 9). The arc should feel earned, not arbitrary.
- Stay inside ONE coherent metaphor or theme. Don't mix unrelated registers (e.g., don't go "Newcomer", "Yogi", "Founder" — pick a lane).
- For "loving" tone: warm, archetypal language. Avoid the spiritual-influencer banlist (sacred, divine, soul, beloved, etc.).
- For "direct" tone: status-clear, no-fluff names.
- For "playful" tone: niche-flavored wordplay is fine; emojis still off.
- No preamble, no explanation.

Respond in this exact format:
<leaderboard>
<level_1>...</level_1>
<level_2>...</level_2>
<level_3>...</level_3>
<level_4>...</level_4>
<level_5>...</level_5>
<level_6>...</level_6>
<level_7>...</level_7>
<level_8>...</level_8>
<level_9>...</level_9>
</leaderboard>`;

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
Brand prefs: ${input.creator.brand_prefs || '<!-- none -->'}
</creator_context>
${input.regenerateNote ? `\n<regenerate_note>${input.regenerateNote}</regenerate_note>\n` : ''}
<task>
Name the 9 leaderboard levels for this community in a ${input.creator.tone} tone. Pick one coherent metaphor; progress from least- to most-advanced.
</task>`;
}

export function parseOutput(raw: string): LeaderboardContent {
  const outer = raw.match(/<leaderboard>([\s\S]*?)<\/leaderboard>/i);
  if (!outer) throw new Error('leaderboard: missing <leaderboard> tag');

  const levels: string[] = [];
  for (let i = 1; i <= NUM_LEVELS; i += 1) {
    const re = new RegExp(`<level_${i}>([\\s\\S]*?)</level_${i}>`, 'i');
    const m = outer[1].match(re);
    if (!m) throw new Error(`leaderboard: missing <level_${i}> tag`);
    const name = m[1].trim();
    if (!name) throw new Error(`leaderboard: level ${i} is empty`);
    if (name.length > LEVEL_MAX_CHARS) {
      throw new Error(
        `leaderboard: level ${i} is ${name.length} chars (max ${LEVEL_MAX_CHARS})`,
      );
    }
    levels.push(name);
  }

  // Reject duplicates — a believable progression has 9 distinct names.
  const seen = new Set<string>();
  for (const name of levels) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`leaderboard: duplicate level name "${name}"`);
    }
    seen.add(key);
  }

  return LeaderboardContentSchema.parse({
    levels: levels as LeaderboardContent['levels'],
  });
}
