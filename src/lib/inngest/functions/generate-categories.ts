import * as prompt from '@/prompts/categories';
import { createModuleFunction } from './_factory';

export const generateCategories = createModuleFunction({
  module: 'categories',
  eventName: 'generate.categories.requested',
  id: 'generate-categories',
  name: 'Generate Categories',
  prompt,
});
