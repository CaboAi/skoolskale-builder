import * as prompt from '@/prompts/calendar';
import { createModuleFunction } from './_factory';

export const generateCalendar = createModuleFunction({
  module: 'calendar',
  eventName: 'generate.calendar.requested',
  id: 'generate-calendar',
  name: 'Generate Calendar',
  prompt,
});
