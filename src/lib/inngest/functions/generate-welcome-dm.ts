import * as prompt from '@/prompts/welcome-dm';
import { createModuleFunction } from './_factory';

export const generateWelcomeDm = createModuleFunction({
  module: 'welcome_dm',
  eventName: 'generate.welcome_dm.requested',
  id: 'generate-welcome-dm',
  name: 'Generate Welcome DM',
  prompt,
});
