import * as prompt from '@/prompts/leaderboard';
import { createModuleFunction } from './_factory';

export const generateLeaderboard = createModuleFunction({
  module: 'leaderboard',
  eventName: 'generate.leaderboard.requested',
  id: 'generate-leaderboard',
  name: 'Generate Leaderboard Levels',
  prompt,
});
