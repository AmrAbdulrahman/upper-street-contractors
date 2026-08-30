/**
 * Schema seed: collapse the four brand-artwork slots into two.
 *
 * `<SiteBanner>` drew the lockup as two images — a crest and a cropped wordmark
 * — so Site settings needed a slot for each, in each tone: four asset pickers on
 * the Brand tab for one logo. The component now renders the single
 * `banner-*.svg` the other two were cropped from, so the settings collapse to
 * what an editor actually thinks they are uploading: a light-background logo and
 * a dark-background one.
 *
 * Nothing is migrated into the new slots. A crest is not the lockup, so copying
 * one across would quietly turn the header into a crest-only mark; empty slots
 * fall back to the built-in artwork, which is the right answer for every site
 * that never overrode it. Uploaded files stay in the media library either way —
 * only the reference to them goes.
 *
 * Removing a declared field is allowed here because `saveSchema` validates the
 * values a READER would see (projected through the next schema, ADR 0011), not
 * the raw stored bag — a leftover key is dropped at read time and cannot
 * invalidate anything.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage: node scripts/seed-merged-logo-fields.mjs
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
  if (!v) throw new Error(`seed-merged-logo-fields: ${name} is required`);
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

const ACTOR = 'seed:merged-logo-fields';
const TYPE = 'site-meta-config';

const RETIRED = [
  'logoCrestDark',
  'logoCrestLight',
  'logoWordmarkDark',
  'logoWordmarkLight',
];

// Named for the background they sit on, not for the ink — an editor picking a
// file is thinking "this is the one for the white header", not "this one is
// navy". (The `tone` prop the component takes is the other way round, and that
// mismatch is exactly why the labels spell it out.)
const NEW_FIELDS = [
  {
    __name: 'logoDark',
    __type: 'asset',
    accept: 'image',
    label: 'Logo — for light backgrounds',
    description:
      'The full lockup (crest + wordmark) shown in the header. Leave empty to keep the built-in artwork.',
    group: 'Brand',
  },
  {
    __name: 'logoLight',
    __type: 'asset',
    accept: 'image',
    label: 'Logo — for dark backgrounds',
    description:
      'The full lockup shown in the footer, where the background is navy. Leave empty to keep the built-in artwork.',
    group: 'Brand',
  },
];

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema));

const configType = nextSchema.find((t) => t.__name === TYPE);
if (!configType) throw new Error(`seed-merged-logo-fields: no "${TYPE}" Type in schema`);

// Slot the pair where the four used to be, so the Brand tab still opens on the
// logos rather than listing them after the favicon.
let insertAt = configType.fields.findIndex((f) => RETIRED.includes(f.__name));
if (insertAt < 0) insertAt = configType.fields.length;

const removed = configType.fields.filter((f) => RETIRED.includes(f.__name)).map((f) => f.__name);
configType.fields = configType.fields.filter((f) => !RETIRED.includes(f.__name));

const added = [];
for (const field of NEW_FIELDS) {
  if (configType.fields.some((f) => f.__name === field.__name)) continue;
  added.push(field.__name);
}
configType.fields.splice(
  Math.min(insertAt, configType.fields.length),
  0,
  ...NEW_FIELDS.filter((f) => added.includes(f.__name))
);

if (removed.length === 0 && added.length === 0) {
  console.log('schema: already up to date.');
  process.exit(0);
}

await adapter.saveSchema(nextSchema, ACTOR, version);

if (removed.length) console.log(`schema: removed ${removed.join(', ')}`);
if (added.length) console.log(`schema: added ${added.join(', ')} (group Brand)`);
console.log('schema: saved.');
console.log(
  'note: the new slots start empty on purpose — the site falls back to /banner-dark.svg and /banner-light.svg.'
);
console.log(
  'next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.'
);
