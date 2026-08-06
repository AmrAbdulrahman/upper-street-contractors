/**
 * Content migration that has to run BEFORE `seed-blogs-schema.mjs` reshapes
 * `blog-post` (drop `meta`, turn `author` from a relation into a `user` name).
 *
 * `Engine.saveSchema` refuses a schema change that would invalidate an existing
 * **published** entry (`DESTRUCTIVE_SCHEMA_EDIT`), and `validateValues` reports a
 * stored key with no matching Field as `'Unknown field'`. So a published post
 * still carrying `meta` blocks the schema edit outright. Note this is about the
 * *key*, not the value: `patch({ meta: null })` leaves `meta` in the bag and is
 * therefore useless here — the key must be gone, which only a full `update`
 * (whole-draft replace) can do.
 *
 * Per post:
 *   1. `meta`   — dropped. The `meta-data` entry it pointed at is left alone
 *                 (unreferenced, harmless); metadata is derived from title +
 *                 excerpt now, so nothing reads it.
 *   2. `author` — a uuid is resolved through the `author` Type and rewritten as
 *                 the person's name (ADR 0016). Anything already a plain name is
 *                 left as-is, so re-runs are no-ops.
 *   3. `slug`   — REPORTED ONLY. A slug that fails the new `slug` kind's pattern
 *                 is printed and the script exits 1. It is never rewritten: a
 *                 published slug is a live URL, and silently moving one is worse
 *                 than stopping.
 *
 * A published post with a **pending draft** is migrated in its draft but NOT
 * published — publishing it would push an editor's unrelated in-progress edits
 * live. Those are listed at the end; publish or discard them in the CMS, then
 * re-run. Idempotent otherwise.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008).
 *
 * Usage: node scripts/migrate-blog-author-and-meta.mjs
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
  if (!v) throw new Error(`migrate-blog-author-and-meta: ${name} is required`);
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

const ACTOR = 'migration:blog-author-meta';
const DRAFT = { status: 'draft', includeUnpublished: true };
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** zero-cms ids are uuids; a name never looks like one. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The values bag behind an OutputEntry — everything that isn't a system field,
 * minus the unset ones.
 *
 * Dropping nulls is load-bearing, not tidiness. Reads are projected through the
 * current schema (`applySchemaDefaults`), which materialises EVERY declared field,
 * using `null` for the ones the stored bag lacks. Writing that back verbatim would
 * store `meta: null` — and the schema guard validates stored **keys**, so a null
 * `meta` blocks the field's removal exactly as a real value would. This is the
 * same rule the app applies on every save (`cleanValues`): blank means unset.
 */
function valuesOf(entry) {
  const out = {};
  for (const [k, v] of Object.entries(entry)) {
    if (k.startsWith('__') || k === 'hasDraft') continue;
    if (v === null || v === undefined || v === '') continue;
    out[k] = v;
  }
  return out;
}

const authorNames = new Map();
async function authorName(id) {
  if (authorNames.has(id)) return authorNames.get(id);
  let name = null;
  try {
    const a = await adapter.get('author', id, DRAFT);
    if (a) name = [a.name, a.lastname].filter(Boolean).join(' ').trim() || null;
  } catch {
    // A dangling author reference is not a reason to abort the whole migration.
  }
  authorNames.set(id, name);
  return name;
}

const { data: posts } = await adapter.query('blog-post', DRAFT);
console.log(`blog-post: ${posts.length} entr${posts.length === 1 ? 'y' : 'ies'}.`);

const badSlugs = [];
const blockedByDraft = [];
let changed = 0;

for (const post of posts) {
  const label = post.slug || post.title || post.__id.slice(0, 8);

  if (typeof post.slug === 'string' && post.slug && !SLUG_PATTERN.test(post.slug)) {
    badSlugs.push({ id: post.__id, slug: post.slug });
  }

  const values = valuesOf(post);
  const next = { ...values };
  const notes = [];

  if (next.meta !== undefined) {
    delete next.meta;
    notes.push('dropped meta');
  }

  if (typeof next.author === 'string' && UUID.test(next.author)) {
    const name = await authorName(next.author);
    if (name) {
      next.author = name;
      notes.push(`author -> "${name}"`);
    } else {
      delete next.author;
      notes.push('author reference was dangling — cleared');
    }
  }

  // Always written, even with nothing in `notes`. A stale key can be sitting in
  // the STORED bag while the projection hides it (an explicit `meta: null` reads
  // back as unset), and only the schema guard ever sees the difference — so this
  // rewrites the normalised bag unconditionally. Content-identical when `notes`
  // is empty, which is what makes a re-run safe.
  const wasPublished = post.__status === 'published';
  // A published post with pending edits: migrate the draft, but leave the
  // published `values` alone rather than publishing someone else's work.
  if (wasPublished && post.hasDraft) {
    blockedByDraft.push(label);
  }

  const saved = await adapter.update('blog-post', post.__id, next, ACTOR, post.__lastEditedAt);
  if (notes.length) changed++;
  console.log(
    `  "${label}": ${notes.length ? notes.join(', ') : 'normalised (no content change)'}.`
  );

  if (wasPublished && !post.hasDraft) {
    await adapter.publish('blog-post', post.__id, ACTOR, saved.__lastEditedAt);
    console.log(`  "${label}": re-published.`);
  }
}

console.log(
  changed ? `migrated ${changed} post(s).` : 'no content changes — already migrated.'
);

if (blockedByDraft.length) {
  console.warn(
    `\nNOT re-published (they had pending drafts, so publishing would push ` +
      `unrelated edits live): ${blockedByDraft.join(', ')}.\n` +
      `Publish or discard each in the CMS, then re-run this script — until then ` +
      `their published values still carry the old fields and the schema edit will refuse.`
  );
}

if (badSlugs.length) {
  console.error(
    `\nRefusing to continue — ${badSlugs.length} slug(s) do not match ` +
      `/^[a-z0-9]+(?:-[a-z0-9]+)*$/ and the new \`slug\` field kind would reject them:\n` +
      badSlugs.map((b) => `  ${b.id.slice(0, 8)}  "${b.slug}"`).join('\n') +
      `\nFix each by hand (each one is a live URL — changing it changes that URL).`
  );
  process.exit(1);
}

if (blockedByDraft.length) process.exit(1);

console.log('migrate-blog-author-and-meta: done.');
