import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
