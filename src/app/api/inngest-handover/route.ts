import { serve } from "inngest/next";
import { inngestHandover } from "@/lib/inngest/client";
import { handoverFunctions } from "@/lib/inngest/functions";

/**
 * Dedicated Inngest serve endpoint for the handover pipeline (separate app
 * id: skoolskale-builder-handover). Split from /api/inngest so the long
 * Opus deliverable steps get their own duration ceiling without touching
 * the module pipeline's 300s cap — which the dashboard's regeneration
 * give-up timer is calibrated against (see PackageDashboard).
 *
 * Proxy allowlists /api/inngest* in src/proxy.ts, which covers this path.
 */

// A 16K-token Opus call at effort:high can run several minutes; 800s is
// Vercel's Fluid compute ceiling and leaves headroom over the worst
// observed deliverable. The UI's handover give-up (20 min) sits above it.
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({
  client: inngestHandover,
  functions: handoverFunctions,
});
