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
  /**
   * `/blogs/*` -> `/blog/*`. The route was renamed to match the singular naming
   * used everywhere in the UI; these keep every already-shared link and indexed
   * URL working. Permanent (308) so crawlers move their index across rather than
   * treating the old path as a second, temporary home for the same content.
   *
   * The `/admin/*` pair matters too: that prefix is a Draft-Mode mirror of the
   * public routes (`proxy.ts` rewrites `/admin/blog/x` -> `/blog/x`), so an
   * editor's bookmarked `/admin/blogs/...` would otherwise 404.
   */
  async redirects() {
    return [
      { source: '/blogs', destination: '/blog', permanent: true },
      { source: '/blogs/:slug', destination: '/blog/:slug', permanent: true },
      { source: '/admin/blogs', destination: '/admin/blog', permanent: true },
      { source: '/admin/blogs/:slug', destination: '/admin/blog/:slug', permanent: true },
    ];
  },
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
