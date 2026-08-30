/**
 * Turn a Project into a page of Sections.
 *
 * A Project was the one kind of content with a bespoke shape: four owned child
 * lists (Deliverables, Timeline Steps, Project images, Client Comments) that
 * only its own route knew how to render, and that a Template had to mirror slot
 * for slot. Everything else on the site — a page, a Blog Post — is a `sections`
 * array an editor composes in place with the Section builder. This makes a
 * Project the same, so one Template shape serves all three kinds.
 *
 * What moves, per Project:
 *
 * - `deliveredSummary` + `deliverables` -> a **Project Scope** section, holding
 *   the SAME Deliverable entries (re-referenced, never copied).
 * - `projectTimeline` -> a **Project Timeline** section, same Timeline Steps.
 * - `projectImages` -> a **Gallery** section. This one is a real conversion: a
 *   Gallery holds Figures, and a Figure and a Project image are the same two
 *   fields (image + caption). A copy per image, rather than a second gallery
 *   Type that says the same thing.
 * - `clientComments` -> one **Quote** section each, `comment` -> `quote` and
 *   `name` -> `attribution`. Same reason: a Quote section already IS "a line of
 *   copy with an attribution".
 *
 * The old fields are left in place by the content pass — nothing is removed
 * until `--drop-fields`, so a migrated Project can be compared against its own
 * source and a bad run is recoverable by clearing `sections`.
 *
 * The `project`-kind Templates get the same treatment: their child lists become
 * `template.sections`, which is what lets the four project-only slots come off
 * the Template Type entirely.
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008: one Upstash Redis + Vercel Blob
 * behind local/staging/prod). Idempotent: a Project that already has `sections`
 * is skipped, so a re-run cannot double-migrate.
 *
 * Usage:
 *   node scripts/migrate-project-sections.mjs                # dry run: print the plan
 *   node scripts/migrate-project-sections.mjs --apply        # schema (additive) + content
 *   node scripts/migrate-project-sections.mjs --drop-fields  # THEN remove the old fields
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const apply = process.argv.includes('--apply');
const dropFields = process.argv.includes('--drop-fields');

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`migrate-project-sections: ${name} is required`);
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

const ACTOR = 'seed:project-sections';
const SCOPE = 'project-scope-section';
const TIMELINE = 'project-timeline-section';
const GALLERY = 'gallery-section';
const QUOTE = 'quote-section';
const FIGURE = 'figure';

/** The fields the swap retires — read by the content pass, removed by --drop-fields. */
const PROJECT_LEGACY = [
  'deliveredSummary',
  'deliverables',
  'clientComments',
  'projectTimeline',
  'projectImages',
];
const TEMPLATE_LEGACY = ['deliverables', 'projectTimeline', 'projectImages', 'clientComments'];

const NEW_TYPES = [
  {
    __name: SCOPE,
    label: 'What We Delivered',
    description: "A completed Project's scope: an intro and a numbered list of Deliverables.",
    // The Service Offer glyph: the same numbered-scope shape, in the opposite
    // tense. Glyph keys are a fixed registry in zero-cms-app, not media.
    thumbnail: 'serviceOffer',
    titleField: 'title',
    fields: [
      { __name: 'overline', __type: 'text', label: 'Overline' },
      { __name: 'title', __type: 'text', label: 'Title' },
      { __name: 'summary', __type: 'longtext', label: 'Intro' },
      {
        __name: 'deliverables',
        __type: 'references',
        label: 'Deliverables',
        allowedTypes: ['deliverable'],
      },
    ],
  },
  {
    __name: TIMELINE,
    label: 'Project Timeline',
    description: 'How a job progressed, as ordered Timeline Steps.',
    thumbnail: 'howItWorks',
    titleField: 'title',
    fields: [
      { __name: 'overline', __type: 'text', label: 'Overline' },
      { __name: 'title', __type: 'text', label: 'Title' },
      {
        __name: 'steps',
        __type: 'references',
        label: 'Steps',
        allowedTypes: ['timeline-step'],
      },
    ],
  },
];

const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

// ---------------------------------------------------------------- 1. schema
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));
let schemaChanged = false;

const typeOf = (name) => {
  const t = next.find((x) => x.__name === name);
  if (!t) throw new Error(`migrate-project-sections: no "${name}" Type in schema`);
  return t;
};
const fieldOf = (type, name) => type.fields.find((f) => f.__name === name);

for (const spec of NEW_TYPES) {
  const idx = next.findIndex((t) => t.__name === spec.__name);
  if (idx === -1) {
    next.push(spec);
    schemaChanged = true;
    console.log(`schema: added Type "${spec.__name}"`);
  } else if (JSON.stringify(next[idx].fields) !== JSON.stringify(spec.fields)) {
    next[idx] = { ...next[idx], ...spec };
    schemaChanged = true;
    console.log(`schema: reconciled Type "${spec.__name}"`);
  }
}

// A Project may hold anything a page may hold, plus the two Types that are only
// about a Project. Read off `page` rather than restated, so the lists cannot
// drift the next time a section Type is added.
const pageSectionTypes = fieldOf(typeOf('page'), 'sections').allowedTypes ?? [];
const projectSectionTypes = [...pageSectionTypes, SCOPE, TIMELINE];

const projectType = typeOf('project');
const projectSections = fieldOf(projectType, 'sections');
if (!projectSections) {
  // Placed before `similarWork`, so the content an editor composes sits above
  // the relations the page derives from.
  const at = projectType.fields.findIndex((f) => f.__name === 'similarWork');
  const field = {
    __name: 'sections',
    __type: 'references',
    label: 'Sections',
    allowedTypes: projectSectionTypes,
  };
  projectType.fields.splice(at === -1 ? projectType.fields.length : at, 0, field);
  schemaChanged = true;
  console.log('schema: added "sections" to project');
} else if (
  JSON.stringify(projectSections.allowedTypes ?? []) !== JSON.stringify(projectSectionTypes)
) {
  projectSections.allowedTypes = projectSectionTypes;
  schemaChanged = true;
  console.log('schema: refreshed project.sections allowedTypes');
}

const templateType = typeOf('template');
const templateSections = fieldOf(templateType, 'sections');
if (JSON.stringify(templateSections.allowedTypes ?? []) !== JSON.stringify(projectSectionTypes)) {
  templateSections.allowedTypes = projectSectionTypes;
  templateSections.description =
    'The shape this template lays down. Every kind uses it — a Project is a list of sections too.';
  schemaChanged = true;
  console.log('schema: refreshed template.sections allowedTypes');
}

if (dropFields) {
  const before = projectType.fields.length + templateType.fields.length;
  projectType.fields = projectType.fields.filter((f) => !PROJECT_LEGACY.includes(f.__name));
  templateType.fields = templateType.fields.filter((f) => !TEMPLATE_LEGACY.includes(f.__name));
  const removed = before - (projectType.fields.length + templateType.fields.length);
  if (removed) {
    schemaChanged = true;
    console.log(`schema: removed ${removed} legacy field(s) from project + template`);
  }
}

if (!apply && !dropFields) {
  console.log(`schema: ${schemaChanged ? 'WOULD CHANGE' : 'already up to date'} (dry run)`);
} else if (schemaChanged) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

if (dropFields) {
  console.log('migrate-project-sections: --drop-fields, done.');
  process.exit(0);
}

// --------------------------------------------------------------- 2. content
/** Create + publish in one step: everything here lands on live, published content. */
async function make(type, values) {
  const created = await adapter.create(type, values, ACTOR);
  const published = await adapter.publish(type, created.__id, ACTOR, created.__lastEditedAt);
  return published.__id;
}

/** A Project image copied into the Figure a Gallery section holds. */
async function figureFrom(id) {
  const src = await adapter.get('project-image', id, {
    status: 'draft',
    includeUnpublished: true,
  });
  if (!src?.image) return null;
  return make(FIGURE, { image: src.image, caption: src.caption ?? null });
}

/** The section list one host's legacy fields become, in reading order. */
async function sectionsFor(host, { plan }) {
  const deliverables = list(host.deliverables);
  const steps = list(host.projectTimeline);
  const images = list(host.projectImages);
  const comments = list(host.clientComments);
  const summary = typeof host.deliveredSummary === 'string' ? host.deliveredSummary : null;

  const ids = [];
  const describe = [];

  if (summary || deliverables.length) {
    describe.push(`scope(${deliverables.length})`);
    if (!plan)
      ids.push(
        await make(SCOPE, {
          overline: 'Project scope',
          title: 'What we delivered',
          summary,
          deliverables,
        })
      );
  }

  // The first quote used to sit between the scope and the timeline; the rest
  // were in the sidebar. Reading order is preserved, the sidebar is not.
  const quoteIds = [];
  for (const commentId of comments) {
    const comment = await adapter.get('client-comment', commentId, {
      status: 'draft',
      includeUnpublished: true,
    });
    if (!comment?.comment) continue;
    describe.push('quote');
    if (!plan)
      quoteIds.push(await make(QUOTE, { quote: comment.comment, attribution: comment.name ?? null }));
  }
  if (quoteIds.length) ids.push(quoteIds.shift());

  if (steps.length) {
    describe.push(`timeline(${steps.length})`);
    if (!plan)
      ids.push(await make(TIMELINE, { overline: 'How it worked', title: 'Project timeline', steps }));
  }

  if (images.length) {
    describe.push(`gallery(${images.length})`);
    if (!plan) {
      const figures = [];
      for (const imageId of images) {
        const figure = await figureFrom(imageId);
        if (figure) figures.push(figure);
      }
      if (figures.length)
        ids.push(await make(GALLERY, { title: 'Photos', images: figures, columns: 3 }));
    }
  }

  ids.push(...quoteIds);
  return { ids, describe };
}

async function migrate(typeName, noun) {
  const res = await adapter.query(typeName, {
    page: { limit: 500 },
    status: 'draft',
    includeUnpublished: true,
  });
  const hosts = typeName === 'template' ? res.data.filter((t) => t.kind === 'project') : res.data;

  for (const host of hosts) {
    const label = `${host.title ?? host.name ?? host.__id.slice(0, 8)}`;
    if (list(host.sections).length) {
      console.log(`  = ${noun} "${label}": already has sections — skipping`);
      continue;
    }
    const { ids, describe } = await sectionsFor(host, { plan: !apply });
    if (!describe.length) {
      console.log(`  · ${noun} "${label}": nothing to move`);
      continue;
    }
    if (!apply) {
      console.log(`  ~ ${noun} "${label}": would create ${describe.join(', ')}`);
      continue;
    }
    const patched = await adapter.patch(
      typeName,
      host.__id,
      { sections: ids },
      ACTOR,
      host.__lastEditedAt
    );
    // Published in the same pass: every one of these is live content, and a
    // Project left half-migrated shows an empty page to the public.
    if (host.__status === 'published')
      await adapter.publish(typeName, host.__id, ACTOR, patched.__lastEditedAt);
    console.log(`  + ${noun} "${label}": ${describe.join(', ')}`);
  }
}

await migrate('project', 'project');
await migrate('template', 'template');

console.log(
  apply
    ? 'migrate-project-sections: content done. Verify, then re-run with --drop-fields.'
    : 'migrate-project-sections: dry run, nothing written. Re-run with --apply.'
);
