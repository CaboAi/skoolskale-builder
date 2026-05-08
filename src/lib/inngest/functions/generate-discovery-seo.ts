import * as prompt from '@/prompts/discovery_seo';
import { createModuleFunction } from './_factory';

export const generateDiscoverySeo = createModuleFunction({
  module: 'discovery_seo',
  eventName: 'generate.discovery_seo.requested',
  id: 'generate-discovery-seo',
  name: 'Generate Discovery SEO Keywords',
  prompt,
});
