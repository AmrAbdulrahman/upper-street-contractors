import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // if CONTENTFUL_PREVIEW is true, build a nextjs app
  // if not (production), build a static website
  output: process.env.CONTENTFUL_PREVIEW ? undefined : 'export',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
      },
      {
        protocol: 'https',
        hostname: 'downloads.ctfassets.net',
      },
    ],
  },
};

export default nextConfig;
