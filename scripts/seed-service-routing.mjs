/**
 * Give Service pages a real routing identity, so one dynamic route can replace
 * the nine hardcoded ones.
 *
 * Until now a Service was three unrelated things: a route file (code), a `page`
 * entry (CMS) and a `service-card` (CMS) carrying a typed-out path. Nothing tied
 * them together - `service-card.href` was free text, and the path -> key mapping
 * (`/kitchens` -> `kitchen-installations-service`) existed only inside
 * `app/(site)/kitchens/page.tsx`. So a Service could not be created from the UI
 * at all: the card would point at a 404 until someone shipped a route file.
 *
 * Two changes fix that:
 *
 *   1. `page.slug` - the URL segment. Optional and with **no `from`**: mirroring
 *      `title` would mint a slug on every page in the CMS, and only Service
 *      pages are routed this way.
 *   2. `service-card.page` - a real reference, replacing `href`. The card's link
 *      is derived from the page's slug, so the two can never drift.
 *
 * Done in two schema passes because the backfill reads `href` to work out which
 * page each card meant: add first, backfill, then remove.
 *
 * **Pass B is behind `--drop-href`, and must not run until the new code is
 * deployed.** The GraphQL schema is generated from this one, and every running
 * copy of the site still selects `ServiceCard.href` - removing the field makes
 * that an unknown-field error, not a null, so `/services` and every page
 * carrying a Service grid would break the moment it lands. Additive pass A plus
 * the backfill is safe to run against live at any time; come back for pass B
 * once nothing reads `href` any more. (The removal itself is permitted:
 * `saveSchema` validates the *projected* values, ADR 0011, not the raw bag.)
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Idempotent: fields are skipped
 * when present, and a card that already points at a page is left alone. Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage:
 *   node scripts/seed-service-routing.mjs              # schema pass A + backfill
 *   node scripts/seed-service-routing.mjs --drop-href  # pass B, AFTER deploying
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
  if (!v) throw new Error(`seed-service-routing: ${name} is required`);
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

const ACTOR = 'seed:service-routing';
const CARD = 'service-card';
const dropHref = process.argv.includes('--drop-href');

/**
 * The nine, as they exist today. `key` is the opaque `page` key the old route
 * file hardcoded; `slug` is the URL segment it served at. The two are not
 * derivable from one another, which is exactly why this table has to exist once
 * - after this runs, the slug is stored and the mapping is data.
 *
 * `title` is the fallback match for a re-run after `href` has already gone.
 */
const SERVICES = [
  { slug: 'refurbishments', key: 'home-refurbishments-service', title: 'Refurbishments' },
  { slug: 'kitchens', key: 'kitchen-installations-service', title: 'Kitchens' },
  { slug: 'bathrooms', key: 'bathroom-renovations-service', title: 'Bathrooms' },
  { slug: 'plumbing', key: 'plumbing-service', title: 'Plumbing' },
  { slug: 'heating', key: 'heating-service', title: 'Heating' },
  { slug: 'electric', key: 'electric-service', title: 'Electric' },
  { slug: 'carpentry', key: 'carpentry-service', title: 'Carpentry' },
  { slug: 'roofing', key: 'roofing-service', title: 'Roofing' },
  { slug: 'handyman', key: 'handyman-service', title: 'Handyman' },
];

const SLUG_FIELD = {
  __name: 'slug',
  __type: 'slug',
  label: 'URL slug',
  description:
    'The URL segment this page serves at, e.g. kitchens for /kitchens. Service pages need one; pages with their own route file do not.',
};

const PAGE_REF_FIELD = {
  __name: 'page',
  __type: 'reference',
  allowedTypes: ['page'],
  label: 'Service page',
  description: 'The page this card links to. The link itself comes from that page URL slug.',
};

// --- helpers ----------------------------------------------------------------

async function readSchema() {
  return {
    schema: JSON.parse(JSON.stringify(await adapter.getSchema())),
    version: await adapter.getSchemaVersion(),
  };
}

function fieldsOf(schema, typeName) {
  const type = schema.find((t) => t.__name === typeName);
  if (!type) throw new Error(`seed-service-routing: no "${typeName}" Type in schema`);
  return type.fields;
}

async function patchAndPublish(type, entry, values) {
  const patched = await adapter.patch(type, entry.__id, values, ACTOR, entry.__lastEditedAt);
  await adapter.publish(type, entry.__id, ACTOR, patched.__lastEditedAt);
}

// --- 1. schema pass A (additive) --------------------------------------------

{
  const { schema, version } = await readSchema();
  let changed = false;

  const pageFields = fieldsOf(schema, 'page');
  if (!pageFields.some((f) => f.__name === 'slug')) {
    // After `key`, before `title`: it is an identity field, not content.
    pageFields.splice(1, 0, SLUG_FIELD);
    changed = true;
    console.log('schema: added page.slug');
  }

  const cardFields = fieldsOf(schema, CARD);
  if (!cardFields.some((f) => f.__name === 'page')) {
    cardFields.push(PAGE_REF_FIELD);
    changed = true;
    console.log(`schema: added ${CARD}.page`);
  }

  if (changed) {
    await adapter.saveSchema(schema, ACTOR, version);
    console.log('schema: pass A saved.');
  } else {
    console.log('schema: pass A already up to date.');
  }
}

// --- 2. backfill ------------------------------------------------------------

const pages = await adapter.query('page', {
  page: { limit: 500 },
  status: 'draft',
  includeUnpublished: true,
});
const pageByKey = new Map(pages.data.map((p) => [p.key, p]));

const cards = await adapter.query(CARD, {
  page: { limit: 200 },
  status: 'draft',
  includeUnpublished: true,
});

for (const service of SERVICES) {
  const page = pageByKey.get(service.key);
  if (!page) {
    console.warn(`  ! no page "${service.key}" - skipping ${service.slug}`);
    continue;
  }

  if (page.slug === service.slug) {
    console.log(`  = page ${service.key}: slug already "${service.slug}"`);
  } else {
    await patchAndPublish('page', page, { slug: service.slug });
    console.log(`  + page ${service.key}: slug "${service.slug}"`);
  }

  // `href` while it still exists, then title - a re-run after pass B has no href.
  const card =
    cards.data.find((c) => c.href === `/${service.slug}`) ??
    cards.data.find((c) => c.title === service.title);

  if (!card) {
    console.warn(`  ! no ${CARD} for ${service.slug} - skipping the link`);
    continue;
  }

  if (card.page === page.__id) {
    console.log(`  = card ${service.title}: already linked`);
    continue;
  }

  await patchAndPublish(CARD, card, { page: page.__id });
  console.log(`  + card ${service.title} -> page ${service.key}`);
}

// --- 3. schema pass B (drop the free-text href) -----------------------------

if (!dropHref) {
  console.log(`schema: leaving ${CARD}.href in place - re-run with --drop-href once the new code is deployed.`);
} else {
  const { schema, version } = await readSchema();
  const cardFields = fieldsOf(schema, CARD);
  const idx = cardFields.findIndex((f) => f.__name === 'href');

  if (idx === -1) {
    console.log(`schema: ${CARD}.href already gone.`);
  } else {
    cardFields.splice(idx, 1);
    await adapter.saveSchema(schema, ACTOR, version);
    console.log(`schema: removed ${CARD}.href - pass B saved.`);
  }
}

console.log('seed-service-routing: done.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
