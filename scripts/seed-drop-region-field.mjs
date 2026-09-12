/**
 * Content seed: retires the Enquiry Wizard's `region` field and puts the
 * remaining address fields in the order the Address lookup fills them.
 *
 * Before: postcode → town → region → addressLine1 → addressLine2
 * After:  postcode → addressLine1 → addressLine2 → town
 *
 * Why `region` goes: it existed because postcodes.io could only ever tell us a
 * town and an administrative region — it holds no PAF address data, so the two
 * address lines were always typed by hand. The Address lookup (ADR 0026)
 * returns real addresses, and Ideal Postcodes' own guidance is to avoid county
 * data: a UK address is identified by line 1 plus a postcode. One fewer box on
 * a phone.
 *
 * Writes DRAFTS ONLY (patch → draft), so live visitors see no change until an
 * Editor hits "Publish all changes" in Inspect mode.
 *
 * Every read passes `status: 'draft', includeUnpublished: true`. Queries default
 * to `published` (ADR 0006) and everything this script writes is a draft —
 * without that the idempotence guard cannot see its own previous run.
 *
 * Reference integrity counts PUBLISHED values, so on the first run the delete is
 * refused (the published step still links `region`) — expected, and not fatal:
 * the unlink and the reorder have already landed. Publish the wizard, re-run,
 * and the orphan goes. Same two-pass shape as
 * scripts/seed-availability-content.mjs.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008) — drafts only.
 *
 * Usage: node scripts/seed-drop-region-field.mjs
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
  if (!v) throw new Error(`seed-drop-region-field: ${name} is required`);
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

const ACTOR = 'seed:drop-region';

/** The field being retired. Matched the way wizard.tsx matches it. */
const REGION_RE = /^(region|county)$/i;
/** The address block, in the order the lookup fills it. */
const ADDRESS_ORDER = ['postcode', 'addressLine1', 'addressLine2', 'town'];

/** See the header: drafts are invisible to a default (published) read. */
const DRAFT_READ = { status: 'draft', includeUnpublished: true };

const allFields = (
  await adapter.query('form-field', { ...DRAFT_READ, page: { limit: 500 } })
).data;
const byId = new Map(allFields.map((f) => [f.__id, f]));
const keyOf = (id) => String(byId.get(id)?.fieldKey ?? '');

const regionIds = new Set(
  allFields.filter((f) => REGION_RE.test(String(f.fieldKey ?? ''))).map((f) => f.__id)
);

// --- find the step that holds the address block ------------------------------
const questions = await adapter.query('form-question', { ...DRAFT_READ, page: { limit: 100 } });
const target = questions.data.find((q) =>
  (Array.isArray(q.fields) ? q.fields : []).some(
    (id) => regionIds.has(id) || ADDRESS_ORDER.includes(keyOf(id))
  )
);

if (!target)
  throw new Error('seed-drop-region-field: no form-question holds the address block');

const before = Array.isArray(target.fields) ? [...target.fields] : [];
const linkedRegion = before.filter((id) => regionIds.has(id));

// --- unlink + reorder --------------------------------------------------------
const withoutRegion = before.filter((id) => !regionIds.has(id));

// Reorder in place: the address fields keep the slots they already occupy, so
// nothing else on the step moves. Only their order among themselves changes.
const slots = withoutRegion
  .map((id, i) => (ADDRESS_ORDER.includes(keyOf(id)) ? i : -1))
  .filter((i) => i >= 0);
const ordered = slots
  .map((i) => withoutRegion[i])
  .sort((a, b) => ADDRESS_ORDER.indexOf(keyOf(a)) - ADDRESS_ORDER.indexOf(keyOf(b)));

const after = [...withoutRegion];
slots.forEach((slot, n) => {
  after[slot] = ordered[n];
});

const unchanged =
  after.length === before.length && after.every((id, i) => id === before[i]);

if (unchanged) {
  console.log(
    `drop-region: step ${target.__id} already reads ${after.map(keyOf).filter((k) => ADDRESS_ORDER.includes(k)).join(' → ')} with no region — nothing to patch`
  );
} else {
  await adapter.patch('form-question', target.__id, { fields: after }, ACTOR, target.__lastEditedAt);
  console.log(
    `drop-region: patched form-question ${target.__id} — fields ${before.length} → ${after.length}; ` +
      `address block now ${after.map(keyOf).filter((k) => ADDRESS_ORDER.includes(k)).join(' → ')} (DRAFT)`
  );
}

// --- delete the orphan -------------------------------------------------------
if (linkedRegion.length === 0 && regionIds.size === 0) {
  console.log('drop-region: no region field left to clean up');
}

for (const id of regionIds) {
  const field = byId.get(id);
  try {
    await adapter.delete('form-field', id, ACTOR, field?.__lastEditedAt);
    console.log(`drop-region: deleted form-field "${field?.fieldKey}" (${id})`);
  } catch (err) {
    console.warn(
      `drop-region: "${field?.fieldKey}" (${id}) is unlinked from the step but still referenced ` +
        `by the published step — publish the wizard, then re-run this script to delete it. ` +
        `Reason: ${err?.message ?? err}`
    );
  }
}

console.log('seed-drop-region-field: done.');
