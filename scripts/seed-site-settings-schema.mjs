/**
 * Schema seed (additive, idempotent): turns `site-meta-config` into the site's
 * Settings screen.
 *
 * Two things happen here.
 *
 * 1. **Groups.** Every field gets a `group`, which the Edit drawer renders as a
 *    tab strip once a Type has more than one. The singleton carries ~20 fields
 *    covering four unrelated jobs — branding, search metadata, contact details,
 *    crawler policy — and as one flat column the useful ones were below the
 *    fold. Nothing about the data changes; this is purely how it is presented.
 *
 * 2. **Branding fields.** The logo was not editable content at all: it was four
 *    SVGs in `public/` (`logo-dark`, `logo-light`, `wordmark-dark`,
 *    `wordmark-light`), so changing it meant a code change and a deploy. Those
 *    four become `asset` fields, plus a favicon and a tagline. All optional —
 *    `SiteBanner` keeps the committed SVGs as its fallback, so an empty field
 *    means "unchanged", never a missing logo.
 *
 * The crest and the wordmark are separate images on purpose, and each tone is
 * its own field rather than one image recoloured: the header sits on light and
 * the footer on dark, and a single asset cannot be legible on both.
 *
 * Additive only, so `saveSchema`'s destructive-edit guard passes. WRITES TO THE
 * SHARED LIVE Redis (ADR 0008) — schema only. Run
 * `nx codegen website --skip-nx-cache` afterwards.
 *
 * Usage: node scripts/seed-site-settings-schema.mjs
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
  if (!v) throw new Error(`seed-site-settings-schema: ${name} is required`);
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

const ACTOR = 'seed:site-settings';
const TYPE = 'site-meta-config';

/** Which tab each existing field belongs on. Anything unlisted lands on Brand. */
const GROUPS = {
  siteName: 'Brand',
  tagline: 'Brand',
  legalName: 'Brand',
  logoCrestDark: 'Brand',
  logoCrestLight: 'Brand',
  logoWordmarkDark: 'Brand',
  logoWordmarkLight: 'Brand',
  favicon: 'Brand',

  siteUrl: 'Metadata',
  pageTitleTemplate: 'Metadata',
  defaultMetaTitle: 'Metadata',
  defaultMetaDescription: 'Metadata',
  defaultImage: 'Metadata',
  locale: 'Metadata',

  phoneNumber: 'Contact',
  email: 'Contact',
  addressLine: 'Contact',
  city: 'Contact',
  postalCode: 'Contact',
  mapLocation: 'Contact',

  socialLinks: 'Social',

  indexable: 'Robots',
};

/** New branding fields. Every one optional — empty means "keep the built-in". */
const NEW_FIELDS = [
  {
    __name: 'tagline',
    __type: 'text',
    label: 'Tagline',
    description: 'One line describing the business. Used where a short strapline is needed.',
    group: 'Brand',
  },
  {
    __name: 'logoCrestDark',
    __type: 'asset',
    accept: 'image',
    label: 'Crest — for light backgrounds',
    description: 'The badge shown beside the wordmark in the header. Leave empty to keep the built-in artwork.',
    group: 'Brand',
  },
  {
    __name: 'logoCrestLight',
    __type: 'asset',
    accept: 'image',
    label: 'Crest — for dark backgrounds',
    description: 'The footer version. A single recoloured file cannot be legible on both tones.',
    group: 'Brand',
  },
  {
    __name: 'logoWordmarkDark',
    __type: 'asset',
    accept: 'image',
    label: 'Wordmark — for light backgrounds',
    description: 'The company name as artwork, shown in the header.',
    group: 'Brand',
  },
  {
    __name: 'logoWordmarkLight',
    __type: 'asset',
    accept: 'image',
    label: 'Wordmark — for dark backgrounds',
    description: 'The footer version of the wordmark.',
    group: 'Brand',
  },
  {
    __name: 'favicon',
    __type: 'asset',
    accept: 'image',
    label: 'Favicon',
    description: 'The small icon browsers show in a tab. Square, ideally SVG or a 512px PNG.',
    group: 'Brand',
  },
];

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));

const type = next.find((t) => t.__name === TYPE);
if (!type) throw new Error(`seed-site-settings-schema: no "${TYPE}" Type in schema`);
type.fields = type.fields ?? [];

let changed = false;

for (const field of NEW_FIELDS) {
  const existing = type.fields.find((f) => f.__name === field.__name);
  if (existing) {
    console.log(`schema: "${TYPE}.${field.__name}" already present — left alone`);
    continue;
  }
  type.fields.push(JSON.parse(JSON.stringify(field)));
  changed = true;
  console.log(`schema: added "${TYPE}.${field.__name}" (${field.__type})`);
}

for (const field of type.fields) {
  const group = GROUPS[field.__name] ?? 'Brand';
  if (field.group === group) continue;
  field.group = group;
  changed = true;
  console.log(`schema: "${TYPE}.${field.__name}" → tab "${group}"`);
}

if (changed) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

console.log('seed-site-settings-schema: done.');
