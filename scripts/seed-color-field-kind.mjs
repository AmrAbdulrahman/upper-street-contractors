/**
 * Schema migration (idempotent): make the two glow-colour fields a real
 * `color` field kind instead of `text`.
 *
 * They shipped as `text` because zero-cms had no colour kind. Asking an editor
 * to type `#fcdd09` into a text box is asking them to do a job the platform has
 * a control for — and a typo is a broken style with no feedback until someone
 * looks at the footer. `color` gives them the native picker, a hex box for
 * pasting a brand value, brand presets, and validation on every write.
 *
 * Safe to run: `saveSchema`'s destructive-edit guard re-validates every
 * PUBLISHED entry against the next schema, and every stored value here is
 * already a valid hex string, so the kind change passes. Any that were not
 * would surface as a named offender rather than a silent break.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage: node scripts/seed-color-field-kind.mjs
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
  if (!v) throw new Error(`seed-color-field-kind: ${name} is required`);
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

const ACTOR = 'seed:color-field-kind';

// The brand palette plus each accreditation body's own mark colour — the
// realistic set of things anyone picks here.
const PRESETS = ['#c8a253', '#0a1c2e', '#ffffff', '#fcdd09', '#e4002b', '#4a90d9', '#00a1de'];

/** [Type, field] pairs to convert. */
const TARGETS = [
  ['accreditation', 'glowColor'],
  ['site-meta-config', 'footerGlowColor'],
];

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema));

let changed = false;

for (const [typeName, fieldName] of TARGETS) {
  const type = nextSchema.find((t) => t.__name === typeName);
  if (!type) {
    console.warn(`  ! no "${typeName}" Type — skipping`);
    continue;
  }

  const field = type.fields.find((f) => f.__name === fieldName);
  if (!field) {
    console.warn(`  ! "${typeName}.${fieldName}" not found — skipping`);
    continue;
  }

  if (field.__type === 'color') {
    console.log(`  = ${typeName}.${fieldName}: already a color field`);
    continue;
  }

  field.__type = 'color';
  field.presets = PRESETS;
  // The old description told an editor to type a CSS colour. There is a picker
  // now, and the accepted set is narrower (hex only).
  field.description =
    typeName === 'accreditation'
      ? 'The glow around this badge in the footer row. Leave empty to use the site-wide colour from Site settings → Footer.'
      : 'Fallback glow colour for footer badges that have none of their own.';

  changed = true;
  console.log(`  ~ ${typeName}.${fieldName}: text -> color`);
}

if (!changed) {
  console.log('schema: already up to date.');
  process.exit(0);
}

await adapter.saveSchema(nextSchema, ACTOR, version);
console.log('schema: saved.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
