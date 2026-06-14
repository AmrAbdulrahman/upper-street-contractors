import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // if ENABLE_PREVIEW is true, build a nextjs app
  // if not (production), build a static website
  output: process.env.ENABLE_PREVIEW === "true" ? undefined : "export",
  // Disable streaming metadata so meta tags always render in <head>
  // (streaming injects them into <body> for non-bot UAs -> fails Lighthouse SEO)
  htmlLimitedBots: /.*/,
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      {
        protocol: "https",
        hostname: "downloads.ctfassets.net",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "1337",
      },
    ],
  },
};

export default nextConfig;
