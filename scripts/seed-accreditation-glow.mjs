/**
 * Schema seed (additive, idempotent): move the Footer accreditation row's glow
 * from one site-wide colour to a colour **per badge**.
 *
 * One colour for the whole row was the wrong unit. Each badge is a different
 * organisation's mark with its own palette — Gas Safe is yellow, NICEIC red,
 * FMB blue — and a single gold glow behind all three fights two of them.
 *
 * `accreditation.glowColor` is therefore the real setting. The Site settings'
 * `footerGlowColor` stays as the **fallback** for badges that have none, so
 * adding a badge still gets a glow without per-entry setup, and the row keeps
 * one place to change them all at once.
 *
 * The existing `footerGlowColor` field is NOT removed: it is still read, and
 * removing a field means `saveSchema`'s destructive-edit guard and a rewrite of
 * every projected value on publish.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage: node scripts/seed-accreditation-glow.mjs
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
  if (!v) throw new Error(`seed-accreditation-glow: ${name} is required`);
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

const ACTOR = 'seed:accreditation-glow';
const TYPE = 'accreditation';

/**
 * Seeded starting colours, matched to each mark's own brand rather than to the
 * site's gold. Keyed on a lowercase substring of the badge title so a renamed
 * entry ("NIC EIC" vs "NICEIC") still matches.
 */
const GLOW_BY_TITLE = [
  { match: 'gas safe', color: '#fcdd09' },
  { match: 'niceic', color: '#e4002b' },
  { match: 'nic eic', color: '#e4002b' },
  { match: 'fmb', color: '#4a90d9' },
  { match: 'trustmark', color: '#00a1de' },
];

// --- schema -----------------------------------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema));

const accType = nextSchema.find((t) => t.__name === TYPE);
if (!accType) throw new Error(`seed-accreditation-glow: no "${TYPE}" Type in schema`);

const FIELD = {
  __name: 'glowColor',
  __type: 'text',
  label: 'Glow colour',
  description:
    'CSS colour for this badge’s glow in the footer row (e.g. #fcdd09). The glow traces the logo’s own shape. Leave empty to use the site-wide colour from Site settings → Footer.',
};

let schemaChanged = false;
if (!accType.fields.some((f) => f.__name === FIELD.__name)) {
  accType.fields.push(FIELD);
  schemaChanged = true;
  console.log(`schema: added "${FIELD.__name}" to ${TYPE}`);
} else {
  console.log(`schema: "${FIELD.__name}" already present`);
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

// --- content: seed a starting colour per badge ------------------------------
const badges = await adapter.query(TYPE, {
  page: { limit: 200 },
  status: 'draft',
  includeUnpublished: true,
});

let filled = 0;

for (const badge of badges.data) {
  if (badge.glowColor) {
    console.log(`  = "${badge.accreditationTitle}": already set (${badge.glowColor})`);
    continue;
  }

  const title = (badge.accreditationTitle ?? '').toLowerCase();
  const hit = GLOW_BY_TITLE.find((g) => title.includes(g.match));
  if (!hit) {
    console.log(`  · "${badge.accreditationTitle}": no brand colour known — falls back to the site colour`);
    continue;
  }

  const patched = await adapter.patch(
    TYPE,
    badge.__id,
    { glowColor: hit.color },
    ACTOR,
    badge.__lastEditedAt
  );
  await adapter.publish(TYPE, badge.__id, ACTOR, patched.__lastEditedAt);

  console.log(`  + "${badge.accreditationTitle}": ${hit.color}`);
  filled += 1;
}

console.log(`seed-accreditation-glow: ${filled} badge(s) given a colour.`);
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
