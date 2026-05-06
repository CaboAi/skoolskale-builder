import * as prompt from '@/prompts/classroom';
import { createModuleFunction } from './_factory';

export const generateClassroom = createModuleFunction({
  module: 'classroom',
  eventName: 'generate.classroom.requested',
  id: 'generate-classroom',
  name: 'Generate Classroom',
  prompt,
});
