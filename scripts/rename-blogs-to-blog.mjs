/**
 * Renames the live Blog index content from the plural "Blogs" to "Blog", to match
 * the route (`/blog`) and every label in the UI.
 *
 * Three visible strings, all on the `blogs` `page` entry and its Page Hero:
 *   page.title       'Blogs' -> 'Blog'
 *   page.description  ...Blogs... -> ...Blog...  (only if it says "Blogs")
 *   page-hero.breadcrumbLabel  'Blogs' -> 'Blog'
 *
 * The entry's `key` stays `blogs`. It is an invisible internal identifier that the
 * route looks itself up by; renaming it would be a live mutation that changes
 * nothing an editor or a visitor can see, for the sake of tidiness.
 *
 * Only touches an entry whose value is still the old string, so a re-run is a
 * no-op and an editor's own later wording is never overwritten. Re-publishes only
 * what was already published, and never publishes over a pending draft (that would
 * push someone's unrelated in-progress edits live) — those are reported instead.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008).
 *
 * Usage: node scripts/rename-blogs-to-blog.mjs
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
  if (!v) throw new Error(`rename-blogs-to-blog: ${name} is required`);
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

const ACTOR = 'migration:blogs-to-blog';
const DRAFT = { status: 'draft', includeUnpublished: true };

const skipped = [];

/** Patch the given string fields, then re-publish if it was published cleanly. */
async function retitle(type, id, changes) {
  const entry = await adapter.get(type, id, DRAFT);
  if (!entry) return false;

  const patch = {};
  for (const [field, [from, to]] of Object.entries(changes)) {
    if (typeof entry[field] === 'string' && entry[field].includes(from)) {
      patch[field] = entry[field].split(from).join(to);
    }
  }
  if (!Object.keys(patch).length) return false;

  const saved = await adapter.patch(type, id, patch, ACTOR, entry.__lastEditedAt);
  for (const [field, value] of Object.entries(patch)) {
    console.log(`${type}.${field}: ${JSON.stringify(value)}`);
  }

  if (entry.__status === 'published') {
    if (entry.hasDraft) {
      skipped.push(`${type} ${id.slice(0, 8)}`);
    } else {
      await adapter.publish(type, id, ACTOR, saved.__lastEditedAt);
      console.log(`${type}: re-published.`);
    }
  }
  return true;
}

const { data: pages } = await adapter.query('page', DRAFT);
const page = pages.find((p) => p.key === 'blogs');
if (!page) throw new Error('rename-blogs-to-blog: no `page` entry with key "blogs"');

let changed = false;

changed =
  (await retitle('page', page.__id, {
    title: ['Blogs', 'Blog'],
    description: ['Blogs', 'Blog'],
  })) || changed;

// The Page Hero is the first section; find it by Type rather than by position.
for (const sectionId of Array.isArray(page.sections) ? page.sections : []) {
  const found = await adapter.locate(sectionId);
  if (found?.type !== 'page-hero') continue;
  changed =
    (await retitle('page-hero', sectionId, { breadcrumbLabel: ['Blogs', 'Blog'] })) || changed;
}

console.log(changed ? 'rename-blogs-to-blog: done.' : 'rename-blogs-to-blog: already renamed.');

if (skipped.length) {
  console.warn(
    `\nPatched but NOT re-published (pending drafts — publishing would push ` +
      `unrelated edits live): ${skipped.join(', ')}. Publish them in the CMS.`
  );
}
