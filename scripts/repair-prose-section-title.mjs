/**
 * Repair: put `title` back on the live `prose-section` Type.
 *
 * scripts/seed-legal-pages.mjs used to reconcile that Type's fields to exactly
 * [overline, body] whenever they differed, which silently dropped the `title`
 * field scripts/seed-about-redesign.mjs had added later — taking the /about
 * intro's heading off the page with it (the value survives in the entry; ADR
 * 0011 projection just stops reading a field the schema no longer declares).
 * The seed no longer does that; this puts back what the last run removed.
 *
 * Additive, so it passes `saveSchema`'s destructive-edit guard, and idempotent:
 * a schema that already declares `title` is left alone.
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008).
 *
 * Usage:
 *   node scripts/repair-prose-section-title.mjs --dry-run   # report only
 *   node scripts/repair-prose-section-title.mjs             # write
 */
import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const dryRun = process.argv.includes('--dry-run');

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`repair-prose-section-title: ${name} is required`);
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

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));

const prose = next.find((t) => t.__name === 'prose-section');
if (!prose) throw new Error('repair-prose-section-title: no "prose-section" Type in schema');

console.log('fields before:', JSON.stringify(prose.fields.map((f) => f.__name)));

if (prose.fields.some((f) => f.__name === 'title')) {
  console.log('title already present — nothing to do.');
  process.exit(0);
}

// Same definition and the same position seed-about-redesign.mjs used.
const at = prose.fields.findIndex((f) => f.__name === 'overline');
prose.fields.splice(at === -1 ? 0 : at + 1, 0, {
  __name: 'title',
  __type: 'text',
  label: 'Title',
});

console.log('fields after: ', JSON.stringify(prose.fields.map((f) => f.__name)));

if (dryRun) {
  console.log('WOULD save (dry-run, no write).');
  process.exit(0);
}

await adapter.saveSchema(next, 'repair:prose-section-title', version);
console.log('schema: saved.');
