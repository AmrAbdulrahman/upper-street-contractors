/**
 * Schema + content seed (additive, idempotent): make the Badge glow tunable.
 *
 * The glow was two hardcoded blur radii — `drop-shadow(0 0 2px C)` plus
 * `drop-shadow(0 0 10px C)` — which was too much bloom for the denser marks and
 * left an editor with nothing to do about it but clear the colour and lose the
 * glow entirely. Radius and intensity are now settings, per badge with a
 * Global Settings fallback, exactly as the colour already was: each badge is a
 * different organisation's mark, and one number cannot suit Gas Safe's solid
 * yellow block and NICEIC's thin outline at once.
 *
 * Two knobs rather than one because they answer different questions. Radius is
 * how far the light travels; intensity is how much of it there is. Shrinking a
 * glow to soften it also detaches it from the logo, which is the opposite of
 * what the glow is for on a navy footer.
 *
 * `glowRadius: 0` is a real off switch — the resolver returns no filter at all.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage: node scripts/seed-glow-radius.mjs
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
  if (!v) throw new Error(`seed-glow-radius: ${name} is required`);
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

const ACTOR = 'seed:glow-radius';

// Mirrored in apps/website/src/helpers/badge-glow.ts — the schema bounds the
// input, the resolver clamps whatever read-time projection actually hands over.
const DEFAULT_RADIUS = 6;
const DEFAULT_INTENSITY = 70;

const RADIUS_FIELD = {
  __type: 'number',
  integer: true,
  min: 0,
  max: 40,
  default: DEFAULT_RADIUS,
};

const INTENSITY_FIELD = {
  __type: 'number',
  integer: true,
  min: 0,
  max: 100,
  default: DEFAULT_INTENSITY,
};

const TARGETS = [
  {
    type: 'accreditation',
    fields: [
      {
        ...RADIUS_FIELD,
        __name: 'glowRadius',
        label: 'Glow size (px)',
        description:
          'How far this badge’s glow spreads. 0 turns the glow off for this badge. Leave empty to use the site-wide setting.',
      },
      {
        ...INTENSITY_FIELD,
        __name: 'glowIntensity',
        label: 'Glow strength (%)',
        description:
          'How strong the glow is, without changing its size. Leave empty to use the site-wide setting.',
      },
    ],
  },
  {
    type: 'site-meta-config',
    fields: [
      {
        ...RADIUS_FIELD,
        __name: 'footerGlowRadius',
        label: 'Badge glow size (px)',
        description:
          'Default glow spread for every badge in the footer row. 0 turns the glow off. A badge with its own setting keeps it.',
        group: 'Footer',
      },
      {
        ...INTENSITY_FIELD,
        __name: 'footerGlowIntensity',
        label: 'Badge glow strength (%)',
        description:
          'Default glow strength for every badge in the footer row. A badge with its own setting keeps it.',
        group: 'Footer',
      },
    ],
  },
];

// --- schema -----------------------------------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema));

let schemaChanged = false;
for (const target of TARGETS) {
  const type = nextSchema.find((t) => t.__name === target.type);
  if (!type) throw new Error(`seed-glow-radius: no "${target.type}" Type in schema`);

  for (const field of target.fields) {
    if (type.fields.some((f) => f.__name === field.__name)) {
      console.log(`schema: "${target.type}.${field.__name}" already present`);
      continue;
    }
    type.fields.push(field);
    schemaChanged = true;
    console.log(`schema: added "${target.type}.${field.__name}"`);
  }
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

// --- content ----------------------------------------------------------------
// Only Global Settings is filled. Per-badge values stay empty on purpose: empty
// means "follow the row", which is what an editor wants until one badge needs
// to differ, and ADR 0011 read-time projection supplies the `default` anyway.
const configs = await adapter.query('site-meta-config', {
  page: { limit: 1 },
  status: 'draft',
  includeUnpublished: true,
});
const config = configs.data[0];

if (!config) {
  console.warn('seed-glow-radius: no site-meta-config entry yet — schema is in place, nothing to fill.');
  process.exit(0);
}

const patch = {};
if (typeof config.footerGlowRadius !== 'number') patch.footerGlowRadius = DEFAULT_RADIUS;
if (typeof config.footerGlowIntensity !== 'number') {
  patch.footerGlowIntensity = DEFAULT_INTENSITY;
}

if (Object.keys(patch).length === 0) {
  console.log('content: already set — leaving it alone.');
  process.exit(0);
}

const patched = await adapter.patch(
  'site-meta-config',
  config.__id,
  patch,
  ACTOR,
  config.__lastEditedAt
);
await adapter.publish('site-meta-config', config.__id, ACTOR, patched.__lastEditedAt);

console.log(`content: ${JSON.stringify(patch)}`);
console.log('seed-glow-radius: done.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
