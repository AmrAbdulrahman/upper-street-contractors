/**
 * Content seed (idempotent): take the "Repairs & Smaller Works" banner off the
 * home page's What We Do section.
 *
 * What We Do is three Work Cards (Bathrooms / Kitchens / Refurbishments) plus a
 * full-width `banner` beneath them pointing at `/repairs-and-smaller-works`.
 * That route was a noindexed placeholder with no real content, and this banner
 * was its only inbound link anywhere on the site — so the section was
 * advertising a page we did not want indexed and had not written.
 *
 * Only the **link** is removed here. The `banner` entry itself is left in the
 * store rather than deleted: Reference integrity refuses a delete while the
 * section's own published version still points at it, and an editor who wants
 * it back should be able to re-link it from the Section builder.
 *
 * The route is deleted in code, with a permanent redirect to `/services`.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008); publishes what it changes.
 * Idempotent: a section with no banner is skipped.
 *
 * Usage: node scripts/seed-remove-repairs-banner.mjs
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`seed-remove-repairs-banner: ${name} is required`);
  return v;
}

const jiti = createJiti(import.meta.url, {
  alias: {
    '@usc/zero-cms-core/node': lib('libs/zero-cms-core/src/node.ts'),
    '@usc/zero-cms-core': lib('libs/zero-cms-core/src/index.ts'),
  },
});

const { createRedisAdapter } = await jiti.import('@usc/zero-cms-core/node');

const adapter = await createRedisAdapter(
  { url: requireEnv('STORAGE_KV_REST_API_URL'), token: requireEnv('STORAGE_KV_REST_API_TOKEN') },
  { token: requireEnv('BLOB_READ_WRITE_TOKEN') }
);

const ACTOR = 'seed:remove-repairs-banner';
const TYPE = 'what-we-do-section';

const sections = await adapter.query(TYPE, {
  page: { limit: 50 },
  status: 'draft',
  includeUnpublished: true,
});

let changed = 0;

for (const section of sections.data) {
  if (!section.banner) {
    console.log(`  = ${section.__id}: no banner — skipping`);
    continue;
  }

  // Confirm it really is the Repairs banner before unlinking. A future editor
  // may have put something else there, and this script should not silently
  // remove whatever it finds.
  const banner = await adapter.get('banner', section.banner, {
    status: 'draft',
    includeUnpublished: true,
  });

  const title = banner?.title ?? '';
  if (!/repair/i.test(title)) {
    console.warn(`  ! ${section.__id}: banner is "${title}" — not the Repairs banner, leaving it.`);
    continue;
  }

  const patched = await adapter.patch(
    TYPE,
    section.__id,
    { banner: null },
    ACTOR,
    section.__lastEditedAt
  );
  await adapter.publish(TYPE, section.__id, ACTOR, patched.__lastEditedAt);

  console.log(`  - ${section.__id}: unlinked banner "${title}" (entry ${section.banner} kept)`);
  changed += 1;
}

// --- 2. the other link nobody expected --------------------------------------
// The banner was not the only pointer at `/repairs-and-smaller-works`: the home
// page's CTA band carries a rich-text `footer` reading "Need a smaller job
// handled professionally? Visit Repairs & Smaller Works to book an hourly
// visit." Left alone it would still resolve — via the 308 — but land on the
// Services index promising an hourly visit it does not describe.
//
// `/handyman` is the true destination for that sentence: multi-trade repairs
// and odd jobs, booked by the hour rather than quoted as a project.
const REPAIRS_PATH = 'repairs-and-smaller-works';
const HANDYMAN = { url: '/handyman', text: 'Visit our Handyman service' };

/** Rewrite any link node pointing at the dead route, in place. */
function retargetLinks(node) {
  if (Array.isArray(node)) return node.map(retargetLinks);
  if (!node || typeof node !== 'object') return node;

  if (node.type === 'link' && typeof node.url === 'string' && node.url.includes(REPAIRS_PATH)) {
    return {
      ...node,
      url: HANDYMAN.url,
      children: [{ type: 'text', text: HANDYMAN.text }],
    };
  }

  return node.children ? { ...node, children: retargetLinks(node.children) } : node;
}

const bands = await adapter.query('planning-renovation-section', {
  page: { limit: 50 },
  status: 'draft',
  includeUnpublished: true,
});

let retargeted = 0;

for (const band of bands.data) {
  if (!Array.isArray(band.footer)) continue;

  const before = JSON.stringify(band.footer);
  const after = retargetLinks(band.footer);
  if (JSON.stringify(after) === before) continue;

  const patched = await adapter.patch(
    'planning-renovation-section',
    band.__id,
    { footer: after },
    ACTOR,
    band.__lastEditedAt
  );
  await adapter.publish(
    'planning-renovation-section',
    band.__id,
    ACTOR,
    patched.__lastEditedAt
  );

  console.log(`  ~ ${band.__id}: footer link retargeted to ${HANDYMAN.url}`);
  retargeted += 1;
}

console.log(
  `seed-remove-repairs-banner: ${changed} banner(s) unlinked, ${retargeted} footer link(s) retargeted.`
);
