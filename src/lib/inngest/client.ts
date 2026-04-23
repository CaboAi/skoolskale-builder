/**
 * Inngest client — the durable execution layer for all long-running work
 * (Claude generation, Gemini image generation, Canva autofills).
 *
 * Functions live in /src/lib/inngest/functions/ and are registered in the
 * /api/inngest route handler (added in Sprint 3).
 */
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'skoolskale-builder',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * Typed event names — add new events here as we build.
 * Keeps event names discoverable and avoids string typos.
 */
export const Events = {
  PackageGenerateRequested: 'package.generate.requested',
  ModuleRegenerateRequested: 'module.regenerate.requested',
  ImageCompositeRequested: 'image.composite.requested',
  CanvaPushRequested: 'canva.push.requested',
} as const;
