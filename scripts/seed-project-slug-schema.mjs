/**
 * Schema seed (additive, idempotent): give the `project` Type a `slug`.
 *
 * A Project's URL was its uuid — `/projects/ebec33b3-d9dc-…` — which is the one
 * public URL on the site that says nothing about what it points at. A Blog Post
 * has had a Slug since it existed; a Project is the same kind of thing (its own
 * page, its own shareable address) and had no reason not to.
 *
 * `slug`, not `text`: core pattern-validates the kind, and `from: 'title'`
 * gives it the Blog Post's derive-then-detach behaviour — it mirrors the title
 * while untouched, and the first manual edit detaches it for good, so renaming
 * a Project never moves a URL somebody has already shared.
 *
 * NOT `required`. Every existing Project predates the field, and a required
 * field with no stored value turns every publish of an old entry into a
 * validation failure (publish rewrites every declared field). The backfill
 * (scripts/seed-project-slugs.mjs) fills them in; the route falls back to the
 * uuid regardless, so a Project with no slug is reachable throughout.
 *
 * Type-level field addition only — no entry is touched here.
 * WRITES TO THE SHARED LIVE Redis (ADR 0008) — schema only.
 *
 * Usage: node scripts/seed-project-slug-schema.mjs
 *        node scripts/seed-project-slug-schema.mjs --dry
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
  if (!v) throw new Error(`seed-project-slug-schema: ${name} is required`);
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

const ACTOR = 'seed:project-slug-schema';
const DRY = process.argv.includes('--dry');

const SLUG_FIELD = {
  __name: 'slug',
  __type: 'slug',
  label: 'URL slug',
  from: 'title',
  description: 'Lowercase words joined by hyphens. Becomes /projects/<slug>.',
};

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));

const project = next.find((type) => type.__name === 'project');
if (!project) throw new Error('seed-project-slug-schema: no `project` type in the schema');

if ((project.fields ?? []).some((f) => f.__name === 'slug')) {
  console.log('schema: `project` already has a slug — left alone.');
} else {
  // Straight after `title`, the field it derives from: the drawer renders
  // fields in declaration order, and a URL belongs next to the name it is
  // made of rather than at the bottom under the relations.
  const fields = project.fields ?? [];
  const titleIndex = fields.findIndex((f) => f.__name === 'title');
  const at = titleIndex === -1 ? 0 : titleIndex + 1;
  fields.splice(at, 0, SLUG_FIELD);
  project.fields = fields;

  if (DRY) {
    console.log('schema: --dry, not saved. Would add `project.slug` at index', at);
  } else {
    await adapter.saveSchema(next, ACTOR, version);
    console.log('schema: saved — `project.slug` added.');
  }
}

console.log('seed-project-slug-schema: done.');
