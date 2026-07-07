/**
 * Rasterize the white brand lockup (public/banner-light.svg) to a PNG for use in
 * HTML emails, where SVG is unreliable. White wordmark + gold crest on a
 * transparent background — sits on the dark email header cell. Run once and
 * commit the output; re-run if the SVG artwork changes:
 *   node scripts/generate-email-logo.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dir, "..", "public");
const src = path.join(publicDir, "banner-light.svg");
const out = path.join(publicDir, "email-logo.png");

await sharp(src, { density: 300 })
  .resize({ width: 600 })
  .png()
  .toFile(out);

console.log("wrote", out);
