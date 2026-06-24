// Copies HugeRTE's skin assets into the website's public dir so the self-hosted
// editor can load its UI skin + iframe content stylesheet by URL (200) instead
// of resolving them under the Turbopack chunk path (404). Idempotent; runs on
// install + before dev/build. See apps/website/src/components/edit-drawer/
// fields/rich-text-field.tsx (skin_url / content_css point at /hugerte/skins).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/hugerte/skins");
const dest = resolve(root, "apps/website/public/hugerte/skins");

if (!existsSync(src)) {
  console.warn(`[copy-hugerte-skins] source not found, skipping: ${src}`);
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-hugerte-skins] copied ${src} -> ${dest}`);
