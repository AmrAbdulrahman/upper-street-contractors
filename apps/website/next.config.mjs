import path from "node:path";
import { fileURLToPath } from "node:url";

import './env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Draft Mode (see lib/app-env.ts) enables draft content + the zero-cms
  // editor bar under /admin/* (proxy.ts).
  // Disable streaming metadata so meta tags always render in <head>
  // (streaming injects them into <body> for non-bot UAs -> fails Lighthouse SEO)
  htmlLimitedBots: /.*/,
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      // zero-cms media (ADR 0008) — real Vercel Blob URLs, e.g.
      // https://<store-id>.public.blob.vercel-storage.com/media/<id>/<file>.
      // <cms-image> passes MediaItem.url straight into next/image, so this is
      // required or every CMS image 400s at render time.
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
