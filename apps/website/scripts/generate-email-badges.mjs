/**
 * Rasterize the enquiry-email trust marks (public/email-badge-*.png) from the
 * originals in scripts/badge-src/, for use in HTML emails where SVG is
 * unreliable. Run once and commit the output; re-run if a mark changes:
 *   node scripts/generate-email-badges.mjs
 *
 * Why the sources are committed rather than read from the CMS at send time:
 * these are frozen copies on purpose. An enquiry send must not depend on the
 * CMS or the Blob store being reachable, and the marks change ~never. The three
 * accreditation badges came from CMS media (the same entries the Footer
 * accreditation row renders); Trustpilot and Google have no CMS asset at all,
 * because the site shows those as live vendor widgets, which an email cannot
 * run. The cost is that swapping a footer badge in the CMS does not reach the
 * emails until someone re-runs this.
 *
 * Sizing mirrors components/ui/accreditation: a fixed height plus a width cap,
 * scaled to fit inside both. Height alone is not enough here — trimming the
 * sources exposes aspect ratios from 0.9:1 (Gas Safe) to 4.5:1 (FMB), so a
 * shared height would let FMB run four times the width of Gas Safe. The two
 * review wordmarks get their own smaller height so they do not dominate the
 * accreditations they sit under.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(dir, "badge-src");
const publicDir = path.join(dir, "..", "public");

/**
 * The email card body these sit on — transparency is flattened onto it so no
 * client has to composite an alpha channel (Outlook and dark-mode readers get
 * that wrong). Keep in sync with BRAND.white in src/lib/email/templates.ts.
 */
const CARD_BG = "#f8fdf9";

/**
 * Rendered bounds in CSS px, per group. Output is 2x for retina. A mark is
 * scaled to fit inside both, so whichever bound binds first wins.
 */
const ACCREDITATION = { height: 40, maxWidth: 110 };
const REVIEW = { height: 24, maxWidth: 110 };

const BADGES = [
  { slug: "fmb", src: "fmb.webp", ...ACCREDITATION },
  { slug: "gas-safe", src: "gas-safe.webp", ...ACCREDITATION },
  { slug: "niceic", src: "niceic.webp", ...ACCREDITATION },
  { slug: "trustpilot", src: "trustpilot.svg", ...REVIEW },
  { slug: "google", src: "google.png", ...REVIEW },
];

const rows = [];

for (const badge of BADGES) {
  const out = path.join(publicDir, `email-badge-${badge.slug}.png`);
  // trim() first: several sources carry transparent margins of their own, and
  // scaling those in makes one mark read smaller than its neighbours.
  const info = await sharp(path.join(srcDir, badge.src), { density: 300 })
    .trim()
    .resize({
      height: badge.height * 2,
      width: badge.maxWidth * 2,
      fit: "inside",
      withoutEnlargement: false,
    })
    .flatten({ background: CARD_BG })
    .png()
    .toFile(out);

  rows.push({
    slug: badge.slug,
    width: Math.round(info.width / 2),
    height: Math.round(info.height / 2),
  });
  console.log(`wrote ${out} (${info.width}x${info.height})`);
}

console.log("\nPaste the width/height pairs into src/lib/email/badges.ts:");
for (const r of rows) {
  console.log(`  ${r.slug.padEnd(12)} width: ${r.width}, height: ${r.height}`);
}
