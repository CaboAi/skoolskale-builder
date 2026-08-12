/**
 * Inngest client — the durable execution layer for all long-running work
 * (Claude generation, Gemini image generation, Canva autofills).
 *
 * Functions live in /src/lib/inngest/functions/ and are registered in the
 * /api/inngest route handler (added in Sprint 3).
 */
import { Inngest } from "inngest";

/**
 * Dev-mode detection.
 *   - `INNGEST_DEV=1` forces dev mode (what `inngest-cli dev` expects locally).
 *   - When NODE_ENV !== 'production' without that flag, the SDK auto-detects,
 *     but passing `isDev` explicitly avoids the handshake failing in edge
 *     cases where a prod-shaped INNGEST_SIGNING_KEY is set in .env.local.
 */
const isDev =
  process.env.INNGEST_DEV === "1" || process.env.NODE_ENV !== "production";

export const inngest = new Inngest({
  id: "skoolskale-builder",
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev,
});

/**
 * Separate Inngest app for the handover pipeline, served at
 * /api/inngest-handover with its own (higher) Vercel maxDuration — a 16K
 * token Opus call can legitimately outlive the module route's 300s cap.
 * A distinct app id keeps the two serve URLs from fighting over one app
 * registration; events route across apps within the same Inngest env, so
 * `inngest.send(...)` from the main client still triggers its functions.
 *
 * Dev: point the dev server at both endpoints —
 *   npx inngest-cli dev -u http://localhost:3000/api/inngest -u http://localhost:3000/api/inngest-handover
 */
export const inngestHandover = new Inngest({
  id: "skoolskale-builder-handover",
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev,
});

/**
 * Typed event names — add new events here as we build.
 * Keeps event names discoverable and avoids string typos.
 */
export const Events = {
  PackageGenerateRequested: "package.generate.requested",
  ModuleRegenerateRequested: "module.regenerate.requested",
  ImageCompositeRequested: "image.composite.requested",
  CanvaPushRequested: "canva.push.requested",
  GenerateCoverRequested: "generate.cover.requested",
  HandoverGenerateRequested: "handover.generate.requested",
  HandoverPdfsRequested: "handover.pdfs.requested",
} as const;
