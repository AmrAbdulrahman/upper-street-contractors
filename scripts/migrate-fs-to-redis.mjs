/**
 * One-time migration: push the old fs-format `.zero-cms-store/` (pre-ADR-0008
 * layout — `types/*.json`, `data.json`, `users.json`, `media/index.json` +
 * loose files) into the live Redis + Vercel Blob backend.
 *
 * Preserves every original id verbatim (entries reference each other, and
 * `asset` fields embed media ids, by id — minting fresh ones via the normal
 * Engine/Adapter API would break every reference). That's why this writes
 * directly through the raw StoragePort/BlobStore rather than going through
 * `createRedisAdapter`/`Engine`, which always mints a new id on create.
 *
 * The old records predate ADR 0009's CAS fields (`__createdAt`/`__lastEditedAt`/
 * `__lastEditedBy` on Entry, `lastEditedBy` on User/MediaItem) — there's no
 * historical value to preserve, so every migrated record is stamped with one
 * shared "now" and `actor: 'migration'`.
 *
 * Usage: node scripts/migrate-fs-to-redis.mjs [--force]
 *   --force  proceed even if the live schema already has Types (default: abort,
 *            so a second accidental run can't clobber real post-migration edits).
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const storeDir = resolve(repoRoot, '.zero-cms-store');
const force = process.argv.includes('--force');

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`migrate-fs-to-redis: ${name} is required`);
  return v;
}

const jiti = createJiti(import.meta.url, {
  alias: {
    '@usc/zero-cms-core/node': lib('libs/zero-cms-core/src/node.ts'),
    '@usc/zero-cms-core': lib('libs/zero-cms-core/src/index.ts'),
  },
});

const { createRedisStoragePort, createVercelBlobStore } = await jiti.import(
  '@usc/zero-cms-core/node'
);

const port = createRedisStoragePort({
  url: requireEnv('STORAGE_KV_REST_API_URL'),
  token: requireEnv('STORAGE_KV_REST_API_TOKEN'),
});
const blobs = createVercelBlobStore({ token: requireEnv('BLOB_READ_WRITE_TOKEN') });

const now = new Date().toISOString();
const ACTOR = 'migration';

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

// --- 1. guard: refuse to clobber a live schema that's already been used -----
const currentSchemaRecord = await port.readSchema();
const currentSchema = currentSchemaRecord?.schema ?? [];
if (currentSchema.length > 0 && !force) {
  throw new Error(
    `migrate-fs-to-redis: live schema already has ${currentSchema.length} Type(s) ` +
      `— refusing to overwrite without --force`
  );
}

// --- 2. schema: one Type per file under types/ ------------------------------
// Some old type files are stale duplicates left over from a rename (same
// `__name`, identical fields, under a different filename) — e.g. `cta.json`
// vs `project-card.json`, where no entry actually uses `__type: "project-card"`.
// Keep the first occurrence per `__name` (alphabetical) and warn on the rest
// rather than writing a Schema with a duplicate Type name.
const typeFiles = (await readdir(join(storeDir, 'types'))).filter((f) => f.endsWith('.json')).sort();
const byName = new Map();
for (const f of typeFiles) {
  const t = await readJson(join(storeDir, 'types', f));
  if (byName.has(t.__name)) {
    console.warn(`schema: skipping ${f} — duplicate Type name "${t.__name}" (kept ${byName.get(t.__name)})`);
    continue;
  }
  byName.set(t.__name, f);
}
const schema = await Promise.all([...byName.values()].map((f) => readJson(join(storeDir, 'types', f))));
console.log(`schema: ${schema.length} Type(s) — ${schema.map((t) => t.__name).join(', ')}`);

const writtenSchema = await port.writeSchema(schema, currentSchemaRecord?.version ?? null);
if (!writtenSchema) throw new Error('migrate-fs-to-redis: writeSchema CAS rejected — retry');

// --- 3. media: index.json manifest + loose bytes files ----------------------
const mediaIndex = await readJson(join(storeDir, 'media', 'index.json'));
console.log(`media: ${mediaIndex.length} item(s)`);
for (const old of mediaIndex) {
  // Old filename on disk is `<id>__<original>`; new MediaItem.filename is just
  // the original (ADR 0008 dropped the prefix now that Blob keys, not fs paths,
  // provide the namespacing).
  const original = old.filename.startsWith(`${old.id}__`)
    ? old.filename.slice(old.id.length + 2)
    : old.filename;
  const bytes = await readFile(join(storeDir, 'media', old.filename));
  const { url } = await blobs.put(`media/${old.id}/${original}`, bytes, old.mime);

  const item = {
    id: old.id,
    filename: original,
    url,
    mime: old.mime,
    size: old.size,
    kind: old.kind,
    ...(old.width != null ? { width: old.width } : {}),
    ...(old.height != null ? { height: old.height } : {}),
    ...(old.alternativeText ? { alternativeText: old.alternativeText } : {}),
    createdAt: old.createdAt ?? now,
    updatedAt: old.createdAt ?? now,
    lastEditedBy: ACTOR,
  };
  await port.createMediaItem(item);
  console.log(`  uploaded ${original} -> ${url}`);
}

// --- 4. users ----------------------------------------------------------------
const oldUsers = await readJson(join(storeDir, 'users.json'));
console.log(`users: ${oldUsers.length}`);
for (const u of oldUsers) {
  await port.createUser({ ...u, lastEditedBy: ACTOR });
}

// --- 5. entries ----------------------------------------------------------------
const oldEntries = await readJson(join(storeDir, 'data.json'));
console.log(`entries: ${oldEntries.length}`);
for (const e of oldEntries) {
  await port.createEntry({
    ...e,
    __createdAt: now,
    __lastEditedAt: now,
    __lastEditedBy: ACTOR,
  });
}

console.log('migrate-fs-to-redis: done.');
