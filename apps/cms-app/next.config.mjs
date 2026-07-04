import path from "node:path";
import { fileURLToPath } from "node:url";

import "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * cms-app: the standalone zero-cms reference server + editor UI (Railway).
 * Always a live Node server (never a static export) — it's the single writer
 * that owns the zero-cms store, so it needs `fs`, a long-lived process, and a
 * persistent disk. See root README -> Architecture.
 *
 * Deliberately NOT `output: "standalone"` — the git-sync module (see
 * src/lib/zero-cms/git-sync.ts) needs a real `.git` working tree with push
 * access at *runtime*, not just at build time. A slim standalone/multi-stage
 * Docker copy would leave `.git` behind. Deploy this as a persistent volume
 * holding the actual git clone; `next build`/`next start` run in place inside it.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
