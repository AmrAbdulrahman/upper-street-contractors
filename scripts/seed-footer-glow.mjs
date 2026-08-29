/**
 * Schema + content seed (additive, idempotent): the Footer accreditation row's
 * glow colour, and a larger default badge height.
 *
 * The row lost its white tiles — on a navy footer a white card is a bright
 * rectangle punched into the page rather than a badge sitting on it. Without
 * the card, a dark logo needs something to separate it from the background, so
 * each mark gets a neon `drop-shadow` traced around its own silhouette. The
 * colour is an editor setting rather than a constant because it is the one
 * thing about this that is a brand decision, not a layout one.
 *
 * Badges also move 44px -> 64px: they were sized to sit politely beside a
 * 130px Trustpilot widget, and the widget has since been brought down to meet
 * them instead.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage: node scripts/seed-footer-glow.mjs
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
  if (!v) throw new Error(`seed-footer-glow: ${name} is required`);
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

const ACTOR = 'seed:footer-glow';
const TYPE = 'site-meta-config';

// The brand gold. A white glow would just read as a blur, and a coloured one
// ties the row to the overlines and CTAs it sits under.
const DEFAULT_GLOW = '#c8a253';
const DEFAULT_LOGO_SIZE = 64;

// --- schema -----------------------------------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema));

const configType = nextSchema.find((t) => t.__name === TYPE);
if (!configType) throw new Error(`seed-footer-glow: no "${TYPE}" Type in schema`);

const FIELD = {
  __name: 'footerGlowColor',
  __type: 'text',
  label: 'Badge glow colour',
  description:
    'CSS colour for the glow around each footer accreditation badge (e.g. #c8a253, or rgba(...)). The glow traces each logo’s own shape. Leave empty for no glow.',
  group: 'Footer',
};

let schemaChanged = false;
if (!configType.fields.some((f) => f.__name === FIELD.__name)) {
  configType.fields.push(FIELD);
  schemaChanged = true;
  console.log(`schema: added "${FIELD.__name}" to ${TYPE} (group Footer)`);
} else {
  console.log(`schema: "${FIELD.__name}" already present`);
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

// --- content ----------------------------------------------------------------
const configs = await adapter.query(TYPE, {
  page: { limit: 1 },
  status: 'draft',
  includeUnpublished: true,
});
const config = configs.data[0];

if (!config) {
  console.warn(`seed-footer-glow: no ${TYPE} entry yet — schema is in place, nothing to fill.`);
  process.exit(0);
}

const patch = {};
if (!config.footerGlowColor) patch.footerGlowColor = DEFAULT_GLOW;
// Only lift the height the earlier seed set; an editor's own number is theirs.
if (!config.footerLogoSize || config.footerLogoSize === 44) {
  patch.footerLogoSize = DEFAULT_LOGO_SIZE;
}

if (Object.keys(patch).length === 0) {
  console.log('content: already set — leaving it alone.');
  process.exit(0);
}

const patched = await adapter.patch(TYPE, config.__id, patch, ACTOR, config.__lastEditedAt);
await adapter.publish(TYPE, config.__id, ACTOR, patched.__lastEditedAt);

console.log(`content: ${JSON.stringify(patch)}`);
console.log('seed-footer-glow: done.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
