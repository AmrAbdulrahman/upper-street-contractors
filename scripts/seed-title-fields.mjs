/**
 * Schema seed (additive, idempotent): set `titleField` on every Type that has
 * no explicit one.
 *
 * The resolver (`entryTitle` in libs/zero-cms-core) already falls back to a
 * Type's first `text`/`longtext` field when `titleField` is absent — the rule
 * that was hardcoded before it. So nothing breaks without this script. What it
 * buys is that the Types admin's Title field dropdown shows a real selection
 * for existing content instead of "Auto", which is the difference between an
 * editor seeing which field names their entries and having to infer it.
 *
 * It also reaches Types the implicit rule cannot name at all — a
 * `separator-section` whose only field is a `lookup`, a `figure` whose only
 * text is a caption sitting after an asset — which is where entries used to
 * show as an 8-character uuid.
 *
 * Preference order below is deliberate: a short human string first, prose only
 * when there is nothing better (a title derived from rich text is three words
 * of a paragraph, which reads as a fragment), and relations never — they hold
 * entry ids, so titling an entry by one would name it after another entry.
 *
 * Entries are NOT touched. A title stays derived, so renaming the source field
 * renames the entry everywhere; snapshotting one into each entry's `__title`
 * would have frozen it and made every entry look manually overridden.
 *
 * Type-level meta only, so it clears `Engine.saveSchema`'s destructive-edit
 * guard trivially. WRITES TO THE SHARED LIVE Redis (ADR 0008) — schema only.
 *
 * Same harness as scripts/seed-availability-schema.mjs.
 *
 * Usage: node scripts/seed-title-fields.mjs
 *        node scripts/seed-title-fields.mjs --dry
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
  if (!v) throw new Error(`seed-title-fields: ${name} is required`);
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

const ACTOR = 'seed:title-fields';
const DRY = process.argv.includes('--dry');

/** Kinds that can title an entry, best first. `reference`/`references` absent. */
const PREFERENCE = [
  'text',
  'longtext',
  'slug',
  'user',
  'lookup',
  'asset',
  'date',
  'richtext',
  'blocks',
  'number',
  'color',
  'boolean',
  'json',
];

/**
 * Field names that ARE a title, best first. This pass runs before the kind
 * preference because kind alone is a bad judge of what names a thing: a
 * `contact-detail-item` declares `emoji` before `label` and a `work-card`
 * declares `emoji` before `title`, so first-text-field picks the emoji — which
 * is exactly the mislabelling this feature exists to fix.
 */
const PREFERRED_NAMES = [
  'title',
  'name',
  'label',
  'question',
  'heading',
  'steptitle',
  'caption',
  'quote',
  'overline',
  'summary',
  'key',
  'code',
];

const eligible = (type) =>
  (type.fields ?? []).filter(
    (f) => f.__type !== 'reference' && f.__type !== 'references'
  );

/**
 * A Type's best title field: a field actually named like a title, else the
 * first field of the most-preferred kind in its own declaration order.
 */
function pickTitleField(type) {
  const fields = eligible(type);
  for (const wanted of PREFERRED_NAMES) {
    const field = fields.find((f) => f.__name.toLowerCase() === wanted);
    if (field) return field;
  }
  for (const kind of PREFERENCE) {
    const field = fields.find((f) => f.__type === kind);
    if (field) return field;
  }
  return undefined;
}

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let changed = false;
const skipped = [];

for (const type of next) {
  const name = type.label ?? type.__name;

  if (type.titleField) {
    const still = (type.fields ?? []).find((f) => f.__name === type.titleField);
    if (!still) {
      // A field renamed or removed since. The resolver tolerates this (it falls
      // back), but leaving a dangling name in the schema makes the admin's
      // dropdown show no selection at all, which reads as a bug.
      console.log(
        `schema: "${type.__name}".titleField -> "${type.titleField}" no longer exists — repointing`
      );
    } else {
      console.log(`schema: "${type.__name}" already titles by "${type.titleField}" — left alone`);
      continue;
    }
  }

  const field = pickTitleField(type);
  if (!field) {
    skipped.push(name);
    if (type.titleField) {
      delete type.titleField;
      changed = true;
    }
    continue;
  }

  type.titleField = field.__name;
  changed = true;
  console.log(`schema: "${type.__name}" titles by "${field.__name}" (${field.__type})`);
}

if (skipped.length) {
  // Only relations (or no fields at all) — these entries read as
  // "Untitled <Type label>" until such a Type gains a field worth naming it by.
  console.log(`schema: nothing can title ${skipped.length} type(s): ${skipped.join(', ')}`);
}

if (!changed) {
  console.log('schema: already up to date.');
} else if (DRY) {
  console.log('schema: --dry, not saved.');
} else {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
}

console.log('seed-title-fields: done.');
