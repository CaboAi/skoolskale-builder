import * as prompt from '@/prompts/transformation';
import { createModuleFunction } from './_factory';

export const generateTransformation = createModuleFunction({
  module: 'transformation',
  eventName: 'generate.transformation.requested',
  id: 'generate-transformation',
  name: 'Generate Transformation taglines',
  prompt,
});
