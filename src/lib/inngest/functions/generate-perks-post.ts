import * as prompt from '@/prompts/perks-post';
import { createModuleFunction } from './_factory';

export const generatePerksPost = createModuleFunction({
  module: 'perks_post',
  eventName: 'generate.perks_post.requested',
  id: 'generate-perks-post',
  name: 'Generate Perks Post',
  prompt,
});
