import { serve } from "inngest/next";
import { inngestImages } from "@/lib/inngest/client";
import { imagesFunctions } from "@/lib/inngest/functions";

/**
 * Dedicated Inngest serve endpoint for the images pipeline (app id
 * skoolskale-builder-images). Split from /api/inngest for the same reasons
 * the handover route was: it keeps sharp's native binaries out of the module
 * pipeline's function bundle, and it lets this route's duration ceiling move
 * on its own.
 *
 * Proxy allowlists /api/inngest* in src/proxy.ts, which covers this path.
 *
 * NOTE: a new app id is a NEW Inngest registration — this URL has to be added
 * as a sync endpoint in Inngest Cloud, and as a third `-u` flag locally:
 *   npx inngest-cli dev -u http://localhost:3000/api/inngest \
 *     -u http://localhost:3000/api/inngest-handover \
 *     -u http://localhost:3000/api/inngest-images
 */

/**
 * 300 is the Hobby plan's hard ceiling (Vercel fails the BUILD above it).
 *
 * This bounds ONE image, not a run: every slot is its own `step.run`, and
 * therefore its own HTTP invocation. A 12-image run is ~30 minutes of wall
 * clock spread across 14 invocations, none of which approaches this cap —
 * gpt-image-1 at quality:"high" runs 60-90s, the provider's own timeout cuts
 * at 150s, and the sharp resize plus upload add low single-digit seconds.
 */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngestImages,
  functions: imagesFunctions,
});
