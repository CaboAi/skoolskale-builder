import * as prompt from '@/prompts/start-here';
import { createModuleFunction } from './_factory';

export const generateStartHere = createModuleFunction({
  module: 'start_here',
  eventName: 'generate.start_here.requested',
  id: 'generate-start-here',
  name: 'Generate Start Here',
  prompt,
});
