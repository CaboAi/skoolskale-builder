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
  /**
   * sharp ships prebuilt native .node binaries per platform and resolves
   * them relative to its own package directory. Bundling relocates the JS
   * away from the binaries and the first resize throws
   * 'Could not load the "sharp" module using the <platform> runtime'.
   * Same failure class as chromium above — externalize, don't bundle.
   *
   * Do NOT add an outputFileTracingIncludes glob for @img/sharp-* to go with
   * this. It looks like the chromium bin/ fix but behaves differently: the
   * platform package contains a NESTED node_modules symlink to
   * @img/sharp-libvips-<platform>, which pnpm resolves into the store. A
   * trailing /** glob follows that symlink and Vercel rejects the result at
   * packaging time with "The framework produced an invalid deployment
   * package for a Serverless Function ... files in symlinked directories"
   * (dpl_DCJN2TuEG3vFvQGGd, build green, deploy failed). Externalizing alone
   * is sufficient: sharp's loader statically requires its platform package,
   * so nft traces it without help.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "sharp"],
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
    /**
     * 3. sharp's Linux native payload. Installing the @img packages is not
     *    enough — they reach the build machine but the tracer does not copy
     *    the .so/.node into the function, so the deployed route dies with
     *    'ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared
     *    object file' (dpl_AWzTjrGX, where the install log shows both
     *    packages added and the runtime still could not load them).
     *
     *    These globs stop at `lib/`, which holds ONLY the binaries. An
     *    earlier version globbed the package root, which also matched its
     *    nested node_modules symlink into the pnpm store and made Vercel
     *    reject the bundle: "The framework produced an invalid deployment
     *    package ... files in symlinked directories" (dpl_DCJN2TuE). Do not
     *    widen these past lib/.
     */
    "/api/inngest-images": [
      "./node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/lib/**",
      "./node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/lib/**",
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
