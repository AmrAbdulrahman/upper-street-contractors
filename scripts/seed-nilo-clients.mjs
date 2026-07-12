/**
 * Migrate the 9 "Our Clients" logos from the old Wix site
 * (nilo-construction.co.uk) into the USC media lib + home Clients Carousel.
 *
 * For each logo: download the full-res PNG from static.wixstatic.com (the
 * original, with the `/v1/fill/…` transform stripped) → parse its pixel size
 * from the PNG header → adapter.putMedia (uploads to Vercel Blob + registers a
 * MediaItem) → create a `client-logo` entry → publish. Then find-or-create the
 * `clients-carousel` and append the new logo ids to its `logos`; if no carousel
 * exists, create one and append it to the home page's sections. All entries are
 * PUBLISHED immediately.
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008). Idempotent: a logo whose `name`
 * already exists as a client-logo is skipped (no re-download, no duplicate), so
 * a re-run is safe.
 *
 * Same harness as scripts/seed-split-sections.mjs.
 *
 * Usage: node scripts/seed-nilo-clients.mjs
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
  if (!v) throw new Error(`seed-nilo-clients: ${name} is required`);
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

const ACTOR = 'seed:nilo-clients';

// name → Wix media id. Full-res original is `.../media/<id>~mv2.png` (no /v1/fill/).
const CLIENTS = [
  { name: 'NHS', id: 'eb9fc2_6cfc560ca9f843cfb78778a47d6575a6' },
  { name: 'BBC', id: 'eb9fc2_a7024bb7b90f48908a357adcc9194dc7' },
  { name: 'CBRE', id: 'eb9fc2_9f841b14694046eabfb75265104d0045' },
  { name: 'The Shard', id: 'eb9fc2_2916c8dd61ab4071b051191418f4def3' },
  { name: 'Bubic', id: 'eb9fc2_ea2ca310c1c0410f83268eef86623af5' },
  { name: 'Humankind', id: 'eb9fc2_61ff57dd2ec2471b85c2eb7b3ff856b5' },
  { name: 'Little Haven Nursery', id: 'eb9fc2_ad4dc2e86d614214b2dabc4898d04e84' },
  { name: 'Tages', id: 'eb9fc2_ae05e91e9bd44493919aff3eb563d4bd' },
  { name: "St Luke's Kentish Town", id: 'eb9fc2_9ef6cb63ca7044148f15f59d207bced3' },
];

const wixUrl = (id) => `https://static.wixstatic.com/media/${id}~mv2.png`;
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// PNG intrinsic size: signature (8 bytes) + IHDR length/type (8) then width @ 16,
// height @ 20 as big-endian uint32. Returns {} for anything that isn't a PNG.
function pngSize(bytes) {
  const isPng =
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (!isPng) return {};
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

// --- 1. existing client-logos (idempotency by name) -------------------------
const existingLogos = await adapter.query('client-logo', { page: { limit: 1000 } });
const existingNames = new Set(
  existingLogos.data.map((l) => String(l.name ?? '').trim().toLowerCase())
);

// --- 2. download → putMedia → create + publish client-logo ------------------
const newLogoIds = [];
for (const c of CLIENTS) {
  if (existingNames.has(c.name.toLowerCase())) {
    console.log(`  = ${c.name}: client-logo already exists — skipping`);
    continue;
  }

  let bytes;
  try {
    const resp = await fetch(wixUrl(c.id));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    bytes = new Uint8Array(await resp.arrayBuffer());
  } catch (e) {
    console.warn(`  ! ${c.name}: download failed (${e.message}) — skipping`);
    continue;
  }

  const media = await adapter.putMedia(
    bytes,
    { filename: `${slug(c.name)}.png`, mime: 'image/png', alternativeText: c.name, ...pngSize(bytes) },
    ACTOR
  );
  const logo = await adapter.create('client-logo', { image: media.id, name: c.name }, ACTOR);
  const pub = await adapter.publish('client-logo', logo.__id, ACTOR, logo.__lastEditedAt);
  newLogoIds.push(pub.__id);
  console.log(`  + ${c.name}: media ${media.id} + client-logo ${pub.__id}`);
}

if (newLogoIds.length === 0) {
  console.log('nilo-clients: no new logos to add.');
} else {
  // --- 3. find-or-create the Clients Carousel, append logos, publish --------
  const carousels = await adapter.query('clients-carousel', { page: { limit: 10 } });

  if (carousels.data.length > 0) {
    const carousel = carousels.data[0];
    if (carousels.data.length > 1)
      console.warn(`  ! ${carousels.data.length} clients-carousel entries — using the first`);
    const logos = [
      ...(Array.isArray(carousel.logos) ? carousel.logos : []),
      ...newLogoIds,
    ];
    const patched = await adapter.patch(
      'clients-carousel',
      carousel.__id,
      { logos },
      ACTOR,
      carousel.__lastEditedAt
    );
    await adapter.publish('clients-carousel', carousel.__id, ACTOR, patched.__lastEditedAt);
    console.log(`  ~ appended ${newLogoIds.length} logo(s) to clients-carousel ${carousel.__id}`);
  } else {
    const carousel = await adapter.create(
      'clients-carousel',
      { title: 'Our clients', logos: newLogoIds },
      ACTOR
    );
    const cpub = await adapter.publish(
      'clients-carousel',
      carousel.__id,
      ACTOR,
      carousel.__lastEditedAt
    );

    const pages = await adapter.query('page', { where: { key: { eq: 'home' } }, page: { limit: 1 } });
    const home = pages.data[0];
    if (!home) throw new Error('seed-nilo-clients: no "home" page found');
    const sections = [...(Array.isArray(home.sections) ? home.sections : []), cpub.__id];
    const patched = await adapter.patch('page', home.__id, { sections }, ACTOR, home.__lastEditedAt);
    await adapter.publish('page', home.__id, ACTOR, patched.__lastEditedAt);
    console.log(`  + created clients-carousel ${cpub.__id} + appended to home page`);
  }
}

console.log('seed-nilo-clients: done.');
