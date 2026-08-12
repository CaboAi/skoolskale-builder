import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Chromium ships a real binary inside its own package directory and
   * resolves it via a path relative to that directory at runtime. Bundling
   * relocates the JS without the `bin/` payload, so the first PDF render
   * dies with: 'The input directory ".../@sparticuz/chromium/bin" does not
   * exist ... you must externalize @sparticuz/chromium'. Externalizing
   * leaves both packages in node_modules where their own path math holds.
   * puppeteer-core rides along for the same reason (it shims native deps).
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // The handover generator reads its framework references + gold examples
  // from disk at runtime (src/prompts/handover/load-assets.ts). Vercel's
  // bundler can't see fs.readFileSync paths, so trace them explicitly into
  // the handover Inngest function's output.
  outputFileTracingIncludes: {
    "/api/inngest-handover": ["./src/prompts/handover/assets/**/*"],
  },
  images: {
    // Supabase Storage URLs for cover-variants, image-variants, creator-photos.
    // Both patterns coexist during the signed-URLs migration window:
    //   - /public/** — legacy public URLs in rows pre-Stage-2 (kept until
    //     Stage 4 verifies no reader code path still emits them).
    //   - /sign/**  — signed URLs emitted by the resolver post-Stage-3.
    // The /public/** entry is removed in the post-Stage-4 cleanup PR.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
