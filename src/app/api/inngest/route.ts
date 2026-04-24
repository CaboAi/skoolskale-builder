import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { functions } from '@/lib/inngest/functions';

/**
 * Inngest webhook endpoint. Inngest Cloud invokes this URL to run the
 * functions registered below. In dev, `npx inngest-cli@latest dev` targets
 * this same route.
 *
 * Proxy allowlists this path in src/proxy.ts so unauthenticated requests
 * from Inngest's infrastructure can reach it.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
