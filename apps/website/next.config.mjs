import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // if CONTENTFUL_PREVIEW is true, build a nextjs app
  // if not (production), build a static website
  output: process.env.CONTENTFUL_PREVIEW ? undefined : "export",
  // Disable streaming metadata so meta tags always render in <head>
  // (streaming injects them into <body> for non-bot UAs -> fails Lighthouse SEO)
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      {
        protocol: "https",
        hostname: "downloads.ctfassets.net",
      },
    ],
  },
};

export default nextConfig;
