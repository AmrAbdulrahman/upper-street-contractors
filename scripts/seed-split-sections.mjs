/**
 * Seed the SplitSection demo content.
 *
 * 1. Adds the `split-section` Type to the live Redis schema and appends it to
 *    the `page` type's `sections` allowedTypes (both idempotent — additive, so
 *    they pass `saveSchema`'s destructive-edit guard).
 * 2. Creates + publishes 2 SplitSection entries on each of the 9 nav (service)
 *    pages, inserted immediately BEFORE that page's Case Studies section,
 *    reusing existing project-hero photos for the image.
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008: one Upstash Redis + Vercel Blob
 * behind local/staging/prod). Entries are published immediately. Idempotent:
 * the schema edit is skipped when already present, and any page that already
 * carries SplitSections is skipped — a re-run cannot double-insert.
 *
 * Same harness as scripts/migrate-fs-to-redis.mjs (jiti + @next/env), but uses
 * the read-write Engine adapter (createRedisAdapter) rather than the raw port.
 *
 * Usage:
 *   node scripts/seed-split-sections.mjs --schema-only   # just add the Type
 *   node scripts/seed-split-sections.mjs                 # schema + entries
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const schemaOnly = process.argv.includes('--schema-only');

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`seed-split-sections: ${name} is required`);
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

const ACTOR = 'seed:split-section';
const TYPE = 'split-section';

// --- 1. schema (idempotent) -------------------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let schemaChanged = false;

// `body` is `blocks` (JSON) — the same rich body kind who-we-are/what-we-do use
// and what <RichTextViewer> renders. (`richtext` maps to a String scalar, which
// would both mis-render and collide with the other sections' JSON `body` inside
// the GetPage union.)
const SPLIT_FIELDS = [
  { __name: 'overline', __type: 'text' },
  { __name: 'body', __type: 'blocks' },
  { __name: 'image', __type: 'asset', accept: 'image' },
  { __name: 'imagePosition', __type: 'lookup', options: ['start', 'end'] },
];

const existingIdx = nextSchema.findIndex((t) => t.__name === TYPE);
if (existingIdx === -1) {
  nextSchema.push({ __name: TYPE, label: 'Split Section', fields: SPLIT_FIELDS });
  schemaChanged = true;
  console.log(`schema: added Type "${TYPE}"`);
} else if (
  JSON.stringify(nextSchema[existingIdx].fields) !== JSON.stringify(SPLIT_FIELDS)
) {
  // Reconcile fields (e.g. correct an earlier richtext `body`) while keeping any
  // type-level stamps. Safe: split-section has no published entries to invalidate.
  nextSchema[existingIdx] = {
    ...nextSchema[existingIdx],
    label: 'Split Section',
    fields: SPLIT_FIELDS,
  };
  schemaChanged = true;
  console.log(`schema: reconciled Type "${TYPE}" fields`);
}

const pageType = nextSchema.find((t) => t.__name === 'page');
if (!pageType) throw new Error('seed-split-sections: no "page" Type in schema');
const sectionsField = pageType.fields.find((f) => f.__name === 'sections');
if (!sectionsField) throw new Error('seed-split-sections: "page" has no "sections" field');
sectionsField.allowedTypes = sectionsField.allowedTypes ?? [];
if (!sectionsField.allowedTypes.includes(TYPE)) {
  sectionsField.allowedTypes.push(TYPE);
  schemaChanged = true;
  console.log('schema: added "split-section" to page.sections allowedTypes');
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

if (schemaOnly) {
  console.log('seed-split-sections: --schema-only, done.');
  process.exit(0);
}

// --- 2. image pool: reuse existing project-hero photos ----------------------
const projects = await adapter.query('project', { page: { limit: 500 } });
let imagePool = [
  ...new Set(projects.data.map((p) => p.hero).filter((x) => typeof x === 'string')),
];
if (imagePool.length === 0) {
  const media = await adapter.listMedia();
  imagePool = media.filter((m) => m.kind === 'image').map((m) => m.id);
}
if (imagePool.length === 0) throw new Error('seed-split-sections: no existing images to reuse');
console.log(`images: reusing ${imagePool.length} existing photo(s)`);
let imgCursor = 0;
const nextImage = () => imagePool[imgCursor++ % imagePool.length]; // eslint-disable-line no-plusplus

// --- 3. Case Studies boundary + existing SplitSections (idempotency) --------
const caseStudies = await adapter.query('case-studies-section', { page: { limit: 100 } });
const caseStudyIds = new Set(caseStudies.data.map((c) => c.__id));
const existingSplit = await adapter.query(TYPE, { page: { limit: 1000 } });
const existingSplitIds = new Set(existingSplit.data.map((e) => e.__id));

// --- 4. per-page demo content -----------------------------------------------
// Nav pages (MAIN_NAV_LINKS) → CMS page keys. All are service pages with a
// Case Studies section.
const PAGES = [
  { key: 'home-refurbishments-service', name: 'refurbishment' },
  { key: 'kitchen-installations-service', name: 'kitchen' },
  { key: 'bathroom-renovations-service', name: 'bathroom' },
  { key: 'plumbing-service', name: 'plumbing' },
  { key: 'heating-service', name: 'heating' },
  { key: 'electric-service', name: 'electrical' },
  { key: 'carpentry-service', name: 'carpentry' },
  { key: 'roofing-service', name: 'roofing' },
  { key: 'handyman-service', name: 'handyman' },
];

// `body` is a Strapi-blocks-compatible array (the shape <RichTextViewer> /
// ZeroCmsBlocks render). Helper builds a paragraph block from plain text.
const p = (text) => ({ type: 'paragraph', children: [{ type: 'text', text }] });

// Two SplitSections per page: one image-end, one image-start (demo both sides).
function entriesFor(name) {
  return [
    {
      overline: 'How we work',
      imagePosition: 'end',
      body: [
        p(
          `Every ${name} project starts with a proper site visit and a clear, ` +
            `fixed quote — no vague estimates that creep once the work begins. ` +
            `You deal with the same owner-led team from first survey to final sign-off.`
        ),
        p(
          `We agree a realistic timeline up front, protect your home while we ` +
            `work, and keep the site tidy at the end of every day.`
        ),
      ],
    },
    {
      overline: 'Built to last',
      imagePosition: 'start',
      body: [
        p(
          `Our ${name} work is finished with quality materials and trades who ` +
            `take pride in the details — the parts you see and the ones you don't.`
        ),
        p(
          `Because we're based in Islington and work across North London, we're ` +
            `close by if you ever need us again.`
        ),
      ],
    },
  ];
}

// --- 5. create + publish entries, insert before Case Studies ----------------
for (const page of PAGES) {
  const res = await adapter.query('page', {
    where: { key: { eq: page.key } },
    page: { limit: 1 },
  });
  const pageEntry = res.data[0];
  if (!pageEntry) {
    console.warn(`  ! "${page.key}" not found — skipping`);
    continue;
  }

  const sections = Array.isArray(pageEntry.sections) ? [...pageEntry.sections] : [];
  if (sections.some((id) => existingSplitIds.has(id))) {
    console.log(`  = ${page.key}: already has SplitSections — skipping`);
    continue;
  }

  const newIds = [];
  for (const spec of entriesFor(page.name)) {
    const created = await adapter.create(
      TYPE,
      {
        overline: spec.overline,
        body: spec.body,
        image: nextImage(),
        imagePosition: spec.imagePosition,
      },
      ACTOR
    );
    const published = await adapter.publish(TYPE, created.__id, ACTOR, created.__lastEditedAt);
    newIds.push(published.__id);
  }

  let idx = sections.findIndex((id) => caseStudyIds.has(id));
  if (idx === -1) idx = sections.length; // no Case Studies found → append
  const nextSections = [...sections.slice(0, idx), ...newIds, ...sections.slice(idx)];

  const patched = await adapter.patch(
    'page',
    pageEntry.__id,
    { sections: nextSections },
    ACTOR,
    pageEntry.__lastEditedAt
  );
  await adapter.publish('page', pageEntry.__id, ACTOR, patched.__lastEditedAt);
  console.log(`  + ${page.key}: inserted 2 SplitSections before Case Studies (index ${idx})`);
}

console.log('seed-split-sections: done.');
