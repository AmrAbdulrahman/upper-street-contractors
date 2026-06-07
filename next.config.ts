import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // if CONTENTFUL_PREVIEW is true, build a nextjs app
  // if not (production), build a static website
  output: process.env.CONTENTFUL_PREVIEW ? undefined : 'export',
  // Disable streaming metadata so meta tags always render in <head>
  // (streaming injects them into <body> for non-bot UAs -> fails Lighthouse SEO)
  htmlLimitedBots: /.*/,
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
