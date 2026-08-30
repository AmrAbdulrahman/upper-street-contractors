/**
 * Seed the `template` Type and a starter library.
 *
 * A Template is a named, reusable starting shape for a new Blog Post, Service
 * page or Project. Picking one deep-copies its children onto a brand new entry
 * (ADR 0019), so the new thing is independent of the template from the first
 * keystroke - unlike the Type picker's *reuse* step, which shares one entry
 * between two places on purpose.
 *
 * ## Why the Type has slots it does not always use
 *
 * A Blog Post and a Service page are both composed of `sections`. A **Project
 * is not** - it has no `sections` field at all. Its content is four owned child
 * lists (deliverables, timeline steps, images, client comments). So one
 * `sections` list cannot template all three, and the Type carries kind-specific
 * slots instead: `sections` for the blog and service kinds, the four lists for
 * project. Only the slots matching `kind` are read.
 *
 * The alternative - three separate Template Types - was rejected because the
 * picker, the "save as template" action and the CONTEXT.md glossary would each
 * have to know about three things that behave identically in every other way.
 *
 * Note the `clientComments` slot deliberately does **not** copy `project`'s
 * `min: 1, max: 2` bounds: a template with no client comments is a perfectly
 * good template, and `min: 1` would make it unsaveable.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Additive only, so `saveSchema`'s
 * destructive-edit guard passes. Idempotent: the Type is reconciled by
 * `__name`, and templates are matched by `name` before being created. Run
 * `nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache`
 * afterwards, then restart `next dev`.
 *
 * Usage:
 *   node scripts/seed-templates.mjs --schema-only
 *   node scripts/seed-templates.mjs
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
  if (!v) throw new Error(`seed-templates: ${name} is required`);
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

const ACTOR = 'seed:templates';
const TEMPLATE = 'template';

/** Blocks helpers - `body` fields are `blocks` (JSON), never `richtext`. */
const text = (t) => ({ type: 'text', text: t });
const p = (t) => ({ type: 'paragraph', children: [text(t)] });
const h = (level, t) => ({ type: 'heading', level, children: [text(t)] });

// --- 1. schema (additive, idempotent) ---------------------------------------

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema));

/**
 * The Template's `sections` accepts whatever a page's does. Read rather than
 * hardcoded: this list has grown five times already, and a copy of it here
 * would be wrong the next time someone adds a section Type.
 */
const pageType = nextSchema.find((t) => t.__name === 'page');
if (!pageType) throw new Error('seed-templates: no "page" Type in schema');
const sectionTypes = pageType.fields.find((f) => f.__name === 'sections')?.allowedTypes;
if (!sectionTypes?.length) throw new Error('seed-templates: page.sections has no allowedTypes');

const TEMPLATE_FIELDS = [
  {
    __name: 'name',
    __type: 'text',
    label: 'Name',
    required: true,
    description: 'What this template is for, as it should read in the picker.',
  },
  {
    __name: 'kind',
    __type: 'lookup',
    label: 'Kind',
    options: ['blog', 'service', 'project'],
    description: 'Which Type this template creates. Only the slots below that match are used.',
  },
  {
    __name: 'sections',
    __type: 'references',
    allowedTypes: [...sectionTypes],
    label: 'Sections',
    description: 'Used by the blog and service kinds. A Project has no sections.',
  },
  {
    __name: 'deliverables',
    __type: 'references',
    allowedTypes: ['deliverable'],
    label: 'Deliverables (project kind)',
  },
  {
    __name: 'projectTimeline',
    __type: 'references',
    allowedTypes: ['timeline-step'],
    label: 'Project timeline (project kind)',
  },
  {
    __name: 'projectImages',
    __type: 'references',
    allowedTypes: ['project-image'],
    label: 'Project images (project kind)',
  },
  {
    // No min/max here, unlike `project.clientComments` - see the header.
    __name: 'clientComments',
    __type: 'references',
    allowedTypes: ['client-comment'],
    label: 'Client comments (project kind)',
  },
];

const existingIdx = nextSchema.findIndex((t) => t.__name === TEMPLATE);
const typeDef = {
  __name: TEMPLATE,
  label: 'Template',
  description: 'A reusable starting shape for a new Blog Post, Service page or Project.',
  thumbnail: 'cardList',
  fields: TEMPLATE_FIELDS,
};

let schemaChanged = false;
if (existingIdx === -1) {
  nextSchema.push(typeDef);
  schemaChanged = true;
  console.log(`schema: added Type "${TEMPLATE}"`);
} else if (JSON.stringify(nextSchema[existingIdx].fields) !== JSON.stringify(TEMPLATE_FIELDS)) {
  nextSchema[existingIdx] = { ...nextSchema[existingIdx], ...typeDef };
  schemaChanged = true;
  console.log(`schema: reconciled Type "${TEMPLATE}"`);
} else {
  console.log(`schema: Type "${TEMPLATE}" already up to date`);
}

// Deliberately NOT added to page.sections / blog-post.sections allowedTypes:
// a Template is not a section, and offering it in the Section builder would let
// an editor drop a template onto a live page.

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
}

if (schemaOnly) {
  console.log('seed-templates: --schema-only, done.');
  process.exit(0);
}

// --- 2. the starter library -------------------------------------------------

async function createPublished(type, values) {
  const created = await adapter.create(type, values, ACTOR);
  const published = await adapter.publish(type, created.__id, ACTOR, created.__lastEditedAt);
  return published.__id;
}

/**
 * Media for the section Types that REQUIRE an asset — `image-section.image` and
 * `project-image.image`. `publish` enforces `required` (unlike `create`), so a
 * filler section with a caption and no photo cannot be published at all, and
 * the seed dies on it.
 *
 * Existing Project heroes are reused rather than uploading anything: a template
 * is a shape, its photos are placeholders the editor replaces, and a second
 * copy of the same bytes is a second thing to replace later. Same trick
 * `seed-services-index.mjs` uses to give the Service cards their photos.
 *
 * With no heroes in the store at all, the asset-bearing sections are dropped
 * from their templates rather than failing — a template one section short is
 * worth more than no templates.
 */
const projectsForMedia = await adapter.query('project', { page: { limit: 500 } });
const heroes = [
  ...new Set(
    projectsForMedia.data.map((p) => p.hero).filter((h) => typeof h === 'string')
  ),
];
const heroAt = (i) => (heroes.length ? heroes[i % heroes.length] : null);

if (!heroes.length) {
  console.warn('  ! no Project heroes found — image sections will be skipped.');
}

/**
 * Every filler template. `sections` / the project lists are thunks so nothing is
 * created for a template that already exists.
 */
const TEMPLATES = [
  {
    name: 'Standard article',
    kind: 'blog',
    sections: () => [
      ['prose-section', { overline: 'Introduction', body: [p('Open with the question this post answers, in one or two sentences.')] }],
      heroAt(0) && ['image-section', { image: heroAt(0), caption: 'Replace with a photo that shows the work.', width: 'wide' }],
      ['prose-section', { overline: 'Detail', body: [h(2, 'The main point'), p('Expand here. Keep paragraphs short.')] }],
      ['quote-section', { quote: 'A line worth pulling out of the copy.', attribution: 'Client, London' }],
      ['separator-section', { variant: 'line' }],
    ],
  },
  {
    name: 'How-to guide',
    kind: 'blog',
    sections: () => [
      ['prose-section', { overline: 'Before you start', body: [p('What the reader needs to know or have to hand.')] }],
      ['prose-section', { overline: 'Steps', body: [h(2, 'Step one'), p('Describe it.'), h(2, 'Step two'), p('Describe it.')] }],
      ['gallery-section', { title: 'Examples', columns: 3 }],
      ['faq', { overline: 'Questions', title: 'Common questions' }],
    ],
  },
  {
    name: 'Standard service page',
    kind: 'service',
    sections: () => [
      ['page-hero', { breadcrumbLabel: 'Service', overline: 'What we do', title: 'Service name', subtitle: 'One sentence on what this service is and who it is for.' }],
      ['service-offer-section', { overline: 'Our offer', title: 'What we deliver', intro: 'A short paragraph on the scope.', callout: 'Fixed quotes, no hidden extras.' }],
      ['split-section', { overline: 'How we work', body: [p('Explain the process alongside a photo.')], imagePosition: 'end' }],
      ['faq', { overline: 'Questions', title: 'Frequently asked' }],
      ['case-studies-section', { overline: 'Recent work', title: 'Projects like yours', category: 'Refurbishment' }],
      ['planning-renovation-section', { overline: 'Get started', title: 'Planning a renovation?', description: 'Tell us about the job and we will come and look at it.' }],
    ],
  },
  {
    name: 'Minimal service page',
    kind: 'service',
    sections: () => [
      ['page-hero', { breadcrumbLabel: 'Service', overline: 'What we do', title: 'Service name', subtitle: 'One sentence on what this service is.' }],
      ['prose-section', { overline: 'About this service', body: [p('Describe the service in a few paragraphs.')] }],
      ['planning-renovation-section', { overline: 'Get started', title: 'Planning a renovation?', description: 'Tell us about the job and we will come and look at it.' }],
    ],
  },
  {
    name: 'Standard case study',
    kind: 'project',
    deliverables: () => [
      ['deliverable', { title: 'Strip out and preparation', description: 'What was removed and made ready.' }],
      ['deliverable', { title: 'First fix', description: 'Structural, plumbing and electrical work.' }],
      ['deliverable', { title: 'Second fix and finishes', description: 'Fitting, decorating and snagging.' }],
    ],
    projectTimeline: () => [
      ['timeline-step', { step: '1', title: 'Survey and quote', description: 'Site visit, measurements and a fixed price.' }],
      ['timeline-step', { step: '2', title: 'Strip out', description: 'Clearing the space and protecting the rest of the house.' }],
      ['timeline-step', { step: '3', title: 'Build', description: 'The main works, week by week.' }],
      ['timeline-step', { step: '4', title: 'Handover', description: 'Snagging, clean and sign-off.' }],
    ],
    projectImages: () => [
      heroAt(0) && ['project-image', { image: heroAt(0), caption: 'Before' }],
      heroAt(1) && ['project-image', { image: heroAt(1), caption: 'During' }],
      heroAt(2) && ['project-image', { image: heroAt(2), caption: 'After' }],
    ],
  },
  {
    name: 'Small job case study',
    kind: 'project',
    deliverables: () => [
      ['deliverable', { title: 'The work', description: 'What was done.' }],
    ],
    projectTimeline: () => [
      ['timeline-step', { step: '1', title: 'Visit and quote', description: 'A look at the job and a price.' }],
      ['timeline-step', { step: '2', title: 'The work', description: 'Done in a day or two.' }],
    ],
    projectImages: () => [heroAt(3) && ['project-image', { image: heroAt(3), caption: 'Finished' }]],
  },
];

const existing = await adapter.query(TEMPLATE, {
  page: { limit: 200 },
  status: 'draft',
  includeUnpublished: true,
});
const byName = new Set(existing.data.map((t) => t.name));

const LIST_SLOTS = ['sections', 'deliverables', 'projectTimeline', 'projectImages', 'clientComments'];

for (const spec of TEMPLATES) {
  if (byName.has(spec.name)) {
    console.log(`  = template "${spec.name}": exists`);
    continue;
  }

  const values = { name: spec.name, kind: spec.kind };

  for (const slot of LIST_SLOTS) {
    const build = spec[slot];
    if (typeof build !== 'function') continue;

    // `.filter(Boolean)`: a spec is null when the media a required asset field
    // needs is not in the store — see `heroAt`.
    const ids = [];
    for (const [type, fields] of build().filter(Boolean)) {
      ids.push(await createPublished(type, fields));
    }
    if (ids.length) values[slot] = ids;
  }

  await createPublished(TEMPLATE, values);
  console.log(`  + template "${spec.name}" (${spec.kind})`);
}

console.log('seed-templates: done.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
