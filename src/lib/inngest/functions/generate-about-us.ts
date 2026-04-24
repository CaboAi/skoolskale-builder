import * as prompt from '@/prompts/about-us';
import { createModuleFunction } from './_factory';

export const generateAboutUs = createModuleFunction({
  module: 'about_us',
  eventName: 'generate.about_us.requested',
  id: 'generate-about-us',
  name: 'Generate About Us',
  prompt,
});
