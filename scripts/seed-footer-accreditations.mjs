/**
 * Seed the Footer accreditation row.
 *
 * The footer shipped three hardcoded **text** labels ("FMB Member",
 * "TrustMark", "Fully Insured") while the home Accreditations section rendered
 * real logos from CMS entries. Two implementations of one idea, and they had
 * already drifted: the home strip shows FMB Member, Gas Safe Register and NICEIC
 * Approved Contractor — one name in common with the footer's three.
 *
 * This gives the footer row the same treatment as every other strip on the
 * site: a `references` list of `accreditation` children plus its own Logo
 * height, on `site-meta-config` so it is one setting for the whole site rather
 * than a section an editor has to find on a page.
 *
 * The entries are **copies**, not the home strip's own. The two rows sit in
 * different places at different sizes and a footer edit should not silently
 * restyle the home page — reuse would have shared them.
 *
 * Additive only, so `saveSchema`'s destructive-edit guard passes. Idempotent:
 * fields are skipped when present, copies are matched by title, and a
 * `footerAccreditations` that already has entries is left alone.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage: node scripts/seed-footer-accreditations.mjs
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
  if (!v) throw new Error(`seed-footer-accreditations: ${name} is required`);
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

const ACTOR = 'seed:footer-accreditations';
const TYPE = 'site-meta-config';

// 44px, not the home strip's 92: the footer row sits under everything else on
// the page and is a reassurance, not a headline.
const DEFAULT_LOGO_SIZE = 44;

// --- 1. schema (additive, idempotent) ---------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema));
let schemaChanged = false;

const configType = nextSchema.find((t) => t.__name === TYPE);
if (!configType) throw new Error(`seed-footer-accreditations: no "${TYPE}" Type in schema`);

const NEW_FIELDS = [
  {
    __name: 'footerAccreditations',
    __type: 'references',
    allowedTypes: ['accreditation'],
    label: 'Accreditation badges',
    description:
      'The logos in the full-width row at the foot of every page. Separate from the Accreditations section on the home page — editing these does not change that one.',
    group: 'Footer',
  },
  {
    __name: 'footerLogoSize',
    __type: 'number',
    integer: true,
    label: 'Badge height (px)',
    description:
      'Sizes every badge in the footer row. Each logo keeps its own aspect ratio, which is what keeps a row of mixed shapes looking even. Does not apply to the Trustpilot widget.',
    group: 'Footer',
  },
];

for (const field of NEW_FIELDS) {
  if (configType.fields.some((f) => f.__name === field.__name)) {
    console.log(`schema: "${field.__name}" already present`);
    continue;
  }

  configType.fields.push(field);
  schemaChanged = true;
  console.log(`schema: added "${field.__name}" to ${TYPE} (group Footer)`);
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

// --- 2. the singleton -------------------------------------------------------
const configs = await adapter.query(TYPE, {
  page: { limit: 1 },
  status: 'draft',
  includeUnpublished: true,
});
const config = configs.data[0];

if (!config) {
  console.warn(`seed-footer-accreditations: no ${TYPE} entry yet — schema is in place, nothing to fill.`);
  process.exit(0);
}

if (Array.isArray(config.footerAccreditations) && config.footerAccreditations.length > 0) {
  console.log('footer row: already populated — leaving it alone.');
  process.exit(0);
}

// --- 3. copy the home strip's badges ----------------------------------------
const lists = await adapter.query('accreditation-list', {
  page: { limit: 10 },
  status: 'draft',
  includeUnpublished: true,
});
const sourceIds = lists.data.flatMap((l) => l.list ?? []);

if (sourceIds.length === 0) {
  console.warn('  ! no Accreditations section to copy from — nothing to seed.');
  process.exit(0);
}

const allBadges = await adapter.query('accreditation', {
  page: { limit: 200 },
  status: 'draft',
  includeUnpublished: true,
});
const badgeById = new Map(allBadges.data.map((b) => [b.__id, b]));

// A previous partial run may have left copies behind; match on title so a
// re-run reuses them instead of stacking up a second set.
const copiesByTitle = new Map();
for (const badge of allBadges.data) {
  if (badge.__lastEditedBy === ACTOR) copiesByTitle.set(badge.accreditationTitle, badge.__id);
}

const footerIds = [];
for (const sourceId of sourceIds) {
  const source = badgeById.get(sourceId);
  if (!source) continue;

  const existingCopy = copiesByTitle.get(source.accreditationTitle);
  if (existingCopy) {
    footerIds.push(existingCopy);
    console.log(`  = "${source.accreditationTitle}": copy exists`);
    continue;
  }

  // The media id is copied as-is: the two rows show the same artwork, and a
  // second upload of identical bytes would be a second thing to replace.
  const created = await adapter.create(
    'accreditation',
    { accreditationTitle: source.accreditationTitle, image: source.image },
    ACTOR
  );
  const published = await adapter.publish(
    'accreditation',
    created.__id,
    ACTOR,
    created.__lastEditedAt
  );
  footerIds.push(published.__id);
  console.log(`  + copied "${source.accreditationTitle}"`);
}

const patched = await adapter.patch(
  TYPE,
  config.__id,
  {
    footerAccreditations: footerIds,
    footerLogoSize: config.footerLogoSize || DEFAULT_LOGO_SIZE,
  },
  ACTOR,
  config.__lastEditedAt
);
await adapter.publish(TYPE, config.__id, ACTOR, patched.__lastEditedAt);

console.log(`footer row: ${footerIds.length} badge(s) at ${DEFAULT_LOGO_SIZE}px.`);
console.log('seed-footer-accreditations: done.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
