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
  /**
   * Two payloads the tracer cannot discover on its own, both loaded by path
   * at runtime rather than imported:
   *
   * 1. The handover framework references + gold examples, read via
   *    fs.readFileSync (src/prompts/handover/load-assets.ts).
   * 2. @sparticuz/chromium's `bin/` archives (~70MB of .br, chromium.br
   *    alone is 64MB). `serverExternalPackages` keeps the package OUT of the
   *    bundle so its own `__dirname`-relative path math still works, but
   *    externalizing does not copy data files — nothing `require`s them, so
   *    nft never sees them and the deployed package ships with an empty
   *    bin/, which fails as: 'The input directory ".../chromium/bin" does
   *    not exist'. The glob is version- and layout-agnostic so a pnpm
   *    upgrade doesn't silently drop the binary again.
   */
  outputFileTracingIncludes: {
    "/api/inngest-handover": [
      "./src/prompts/handover/assets/**/*",
      "./node_modules/.pnpm/**/@sparticuz/chromium/bin/**",
    ],
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
