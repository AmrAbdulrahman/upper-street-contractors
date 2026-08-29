/**
 * Turn the wizard's Step introduction into a referenced Rich Text Block.
 *
 * It was a `blocks` field inline on each question, so the copy could only be
 * edited inside that step's own drawer and could not be shared between steps.
 * As a reference it becomes an entry in its own right: its own pencil in
 * inspect mode, the full block editor, and reusable wherever the same
 * explanation belongs.
 *
 * **Why three phases rather than one field-kind change.** `saveSchema`'s
 * destructive-edit guard re-validates every PUBLISHED entry against the next
 * schema. Flipping `body` from `blocks` to `reference` in a single save would
 * check the existing array values against "expected entry id" and refuse — and
 * the data cannot be migrated first, because while the field is still `blocks`
 * an id string fails the other way. So:
 *
 *   1. ADD `intro` (reference -> rich-text-block) alongside `body`.
 *   2. MOVE each body's blocks into a new rich-text-block entry, point `intro`
 *      at it, publish.
 *   3. REMOVE `body`. Safe by then: ADR 0011 drops a stored key the Type no
 *      longer declares at read time, so the leftover array is never projected
 *      and cannot invalidate anything.
 *
 * Covers `image-question`, `form-question` and `step-copy` — a variant
 * overrides the intro exactly as it did, so it needs the same shape.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Idempotent at every phase. Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage:
 *   node scripts/seed-step-intro-block.mjs            # all three phases
 *   node scripts/seed-step-intro-block.mjs --keep-body  # phases 1-2 only
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const keepBody = process.argv.includes('--keep-body');

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`seed-step-intro-block: ${name} is required`);
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

const ACTOR = 'seed:step-intro-block';
const BLOCK = 'rich-text-block';
const HOSTS = ['image-question', 'form-question', 'step-copy'];

const INTRO_FIELD = {
  __name: 'intro',
  __type: 'reference',
  allowedTypes: [BLOCK],
  label: 'Step introduction',
  description:
    'The rich-text block shown beneath this step’s inputs. Its own entry, so it can be edited on its own and reused on another step.',
};

// --- phase 1: schema (additive) ---------------------------------------------
{
  const schema = await adapter.getSchema();
  const version = await adapter.getSchemaVersion();
  const next = JSON.parse(JSON.stringify(schema));
  let changed = false;

  if (!next.some((t) => t.__name === BLOCK)) {
    next.push({
      __name: BLOCK,
      label: 'Rich Text Block',
      description: 'A passage of rich text, held as its own entry so it can be reused.',
      thumbnail: 'richText',
      fields: [{ __name: 'body', __type: 'blocks', label: 'Body' }],
    });
    changed = true;
    console.log(`schema: added Type "${BLOCK}"`);
  }

  for (const host of HOSTS) {
    const type = next.find((t) => t.__name === host);
    if (!type) {
      console.warn(`  ! no "${host}" Type — skipping`);
      continue;
    }
    if (type.fields.some((f) => f.__name === 'intro')) continue;
    type.fields.push({ ...INTRO_FIELD });
    changed = true;
    console.log(`schema: added "intro" to ${host}`);
  }

  if (changed) {
    await adapter.saveSchema(next, ACTOR, version);
    console.log('schema: phase 1 saved.');
  } else {
    console.log('schema: phase 1 already applied.');
  }
}

// --- phase 2: move each body into its own block ------------------------------
let moved = 0;

for (const host of HOSTS) {
  const entries = await adapter.query(host, {
    page: { limit: 500 },
    status: 'draft',
    includeUnpublished: true,
  });

  for (const entry of entries.data) {
    if (entry.intro) continue; // already migrated
    const body = entry.body;
    if (!Array.isArray(body) || body.length === 0) continue;

    const block = await adapter.create(BLOCK, { body }, ACTOR);
    const publishedBlock = await adapter.publish(BLOCK, block.__id, ACTOR, block.__lastEditedAt);

    const patched = await adapter.patch(
      host,
      entry.__id,
      { intro: publishedBlock.__id },
      ACTOR,
      entry.__lastEditedAt
    );
    // Only re-publish what was already public; an unpublished draft stays one.
    if (entry.__status === 'published') {
      await adapter.publish(host, entry.__id, ACTOR, patched.__lastEditedAt);
    }

    const label = entry.stepLabel ?? entry.title ?? entry.__id;
    console.log(`  + ${host} "${label}": intro -> ${publishedBlock.__id}`);
    moved += 1;
  }
}

console.log(`content: ${moved} introduction(s) moved into blocks.`);

if (keepBody) {
  console.log('seed-step-intro-block: --keep-body, stopping before phase 3.');
  process.exit(0);
}

// --- phase 3: drop the old inline field --------------------------------------
{
  const schema = await adapter.getSchema();
  const version = await adapter.getSchemaVersion();
  const next = JSON.parse(JSON.stringify(schema));
  let changed = false;

  for (const host of HOSTS) {
    const type = next.find((t) => t.__name === host);
    if (!type) continue;
    const before = type.fields.length;
    type.fields = type.fields.filter((f) => f.__name !== 'body');
    if (type.fields.length !== before) {
      changed = true;
      console.log(`schema: removed "body" from ${host}`);
    }
  }

  if (changed) {
    await adapter.saveSchema(next, ACTOR, version);
    console.log('schema: phase 3 saved.');
  } else {
    console.log('schema: phase 3 already applied.');
  }
}

console.log('seed-step-intro-block: done.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
