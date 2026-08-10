import { serve } from "inngest/next";
import { inngestHandover } from "@/lib/inngest/client";
import { handoverFunctions } from "@/lib/inngest/functions";

/**
 * Dedicated Inngest serve endpoint for the handover pipeline (separate app
 * id: skoolskale-builder-handover). Split from /api/inngest so the heavy
 * Chromium dependency and the long Opus steps stay out of the module
 * pipeline's function bundle, and so this route's duration ceiling can be
 * raised independently of the module route — whose 300s cap the dashboard
 * regeneration give-up timer is calibrated against (see PackageDashboard).
 *
 * Proxy allowlists /api/inngest* in src/proxy.ts, which covers this path.
 */

/**
 * 300 is the Hobby plan's hard ceiling — Vercel fails the BUILD on any
 * higher value ("maxDuration between 1 and 300 for plan hobby"), so this
 * is not a knob to tune upward without a plan change. Pro/Fluid allows 800.
 *
 * A deliverable that outruns 300s gets killed mid-stream; Inngest retries
 * the step (3x) and each retry re-reads the prompt cache, but a chronically
 * slow doc would need either the plan bump or a lower `effort` in
 * generate-handover.ts. Watch step wall-clock on the first prod run.
 */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngestHandover,
  functions: handoverFunctions,
});
