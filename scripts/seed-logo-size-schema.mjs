/**
 * Schema seed (additive, idempotent): gives editors a pixel control over the
 * logo strips in two sections.
 *
 *   1. `accreditation-list.logoSize` — the rendered HEIGHT in px of every
 *      accreditation badge on the line. The Trustpilot widget beside them is
 *      derived from it (1.25x, see TRUSTPILOT_HEIGHT_RATIO in
 *      accreditation-list.tsx), so one number sizes the whole row.
 *   2. `clients-carousel.logoSize` — same idea for the Trusted-by client logos.
 *
 * Defaults match the Tailwind heights these sections hardcoded before
 * (`h-14` = 56px, `h-12` = 48px), so nothing moves until an editor changes it.
 *
 * `min`/`max` are set here rather than in /admin because the Type builder only
 * exposes the `integer` checkbox for number fields (libs/zero-cms-app
 * type-builder.tsx), not the bounds.
 *
 * Both edits are additive field adds, so they clear `Engine.saveSchema`'s
 * destructive-edit guard (it validates existing PUBLISHED values with
 * `forPublish: false`, which skips absent fields). Per ADR 0011 read-time
 * projection injects `default` into entries stored before the field existed —
 * no backfill needed. WRITES TO THE SHARED LIVE Redis (ADR 0008) — schema only;
 * no entries are created or modified here.
 *
 * Same harness as scripts/seed-faq-timing-schema.mjs.
 *
 * Usage: node scripts/seed-logo-size-schema.mjs
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
  if (!v) throw new Error(`seed-logo-size-schema: ${name} is required`);
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

const ACTOR = 'seed:logo-size';

/** Which Type gets a `logoSize`, and the default that preserves its current look. */
const TARGETS = [
  { type: 'accreditation-list', default: 56 }, // was `h-14` on the badge image
  { type: 'clients-carousel', default: 48 }, // was `h-12` on the client logo
];

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let changed = false;

for (const target of TARGETS) {
  const type = next.find((t) => t.__name === target.type);
  if (!type) throw new Error(`seed-logo-size-schema: no "${target.type}" Type in schema`);
  type.fields = type.fields ?? [];

  const existing = type.fields.find((f) => f.__name === 'logoSize');
  if (existing) {
    if (existing.__type !== 'number')
      throw new Error(
        `seed-logo-size-schema: "${target.type}.logoSize" is __type "${existing.__type}", expected "number"`
      );
    console.log(`schema: "${target.type}.logoSize" already present — left alone`);
    continue;
  }

  type.fields.push({
    __name: 'logoSize',
    __type: 'number',
    label: 'Logo height (px)',
    description: 'Rendered height of each logo. Width scales with the image.',
    integer: true,
    min: 16,
    max: 200,
    default: target.default,
  });
  changed = true;
  console.log(`schema: added "${target.type}.logoSize" (default ${target.default})`);
}

if (changed) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

console.log('seed-logo-size-schema: done.');
