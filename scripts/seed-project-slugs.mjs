/**
 * Content backfill (idempotent): give every existing Project a Slug.
 *
 * Runs after scripts/seed-project-slug-schema.mjs adds the field. New Projects
 * derive their slug from the title on their own (`from: 'title'`); these
 * predate the field and have nothing stored, so the URL they would publish is
 * still the uuid.
 *
 * Slugs are derived from the title and **deduplicated here**, because zero-cms
 * enforces no uniqueness: two Projects claiming one slug would leave the second
 * permanently shadowed by the first (the route takes the first match). A
 * collision gets `-2`, `-3`, … rather than being skipped, so every Project ends
 * up reachable by a real URL.
 *
 * A Project whose title is empty (or slugifies to nothing) is left alone: it
 * keeps working on its uuid, which the route still resolves.
 *
 * Published Projects are re-published after the patch — a slug sitting in a
 * draft is a URL the public cannot reach, and this is live content.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008) — entries.
 *
 * Usage: node scripts/seed-project-slugs.mjs --dry   (default is dry)
 *        node scripts/seed-project-slugs.mjs --apply
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
  if (!v) throw new Error(`seed-project-slugs: ${name} is required`);
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

const ACTOR = 'seed:project-slugs';
const APPLY = process.argv.includes('--apply');

/** The same shape the `slug` field kind validates: lowercase words, hyphens. */
function slugify(value) {
  return (value ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

// Draft read: a published-only read cannot see a slug written by an earlier
// run of this script that has not been published yet, and would re-derive one
// that is already there.
const res = await adapter.query('project', {
  page: { limit: 500 },
  status: 'draft',
  includeUnpublished: true,
});

const projects = res.data ?? [];
const taken = new Set(
  projects.map((p) => p.slug?.trim()).filter(Boolean)
);

let planned = 0;
for (const project of projects) {
  const label = project.title ?? project.__id.slice(0, 8);

  if (project.slug?.trim()) {
    console.log(`  = "${label}": already /projects/${project.slug}`);
    continue;
  }

  const base = slugify(project.title);
  if (!base) {
    console.log(`  · "${label}": no title to derive from — left on its uuid`);
    continue;
  }

  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  taken.add(slug);
  planned++;

  if (!APPLY) {
    console.log(`  ~ "${label}": would become /projects/${slug}`);
    continue;
  }

  const patched = await adapter.patch(
    'project',
    project.__id,
    { slug },
    ACTOR,
    project.__lastEditedAt
  );
  if (project.__status === 'published')
    await adapter.publish('project', project.__id, ACTOR, patched.__lastEditedAt);

  console.log(`  + "${label}": /projects/${slug}`);
}

console.log(
  APPLY
    ? `seed-project-slugs: done — ${planned} slug(s) written.`
    : `seed-project-slugs: dry run — ${planned} slug(s) would be written. Re-run with --apply.`
);
