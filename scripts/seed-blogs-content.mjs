/**
 * Content seed for the Blog feature: the `blogs` page entry (so /blog has a
 * Page Hero above the index) plus three sample Blog Posts, each built from a few
 * of the new section Types so the Section builder has something real to work on.
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008: one Upstash Redis + Vercel Blob
 * behind local/staging/prod). Entries are created and published immediately.
 *
 * Idempotent. Every guard reads with `status: 'draft', includeUnpublished: true`
 * — queries default to PUBLISHED, so a guard reading the default would not see a
 * previous run's unpublished output and would duplicate it on every invocation.
 *
 * Run scripts/seed-blogs-schema.mjs FIRST; this aborts if the Types are missing.
 *
 * Usage:
 *   node scripts/seed-blogs-content.mjs --dry-run   # report, write nothing
 *   node scripts/seed-blogs-content.mjs
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const dryRun = process.argv.includes('--dry-run');

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`seed-blogs-content: ${name} is required`);
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

const ACTOR = 'seed:blogs-content';

// --- preflight: the schema seed must have run --------------------------------
const schema = await adapter.getSchema();
for (const t of ['blog-post', 'prose-section', 'quote-section', 'separator-section', 'page-hero']) {
  if (!schema.find((x) => x.__name === t))
    throw new Error(`seed-blogs-content: Type "${t}" missing — run seed-blogs-schema.mjs first`);
}

// --- helpers ----------------------------------------------------------------
const DRAFT = { status: 'draft', includeUnpublished: true };

async function createPublished(type, values) {
  if (dryRun) {
    console.log(`[dry-run] would create ${type}`);
    return { __id: `dry-${type}` };
  }
  const created = await adapter.create(type, values, ACTOR);
  await adapter.publish(type, created.__id, ACTOR, created.__lastEditedAt);
  return created;
}

/** Blocks helpers — `body` fields are `blocks` (JSON), never `richtext`. */
const text = (t, extra = {}) => ({ type: 'text', text: t, ...extra });
const p = (...children) => ({ type: 'paragraph', children: children.length ? children : [text('')] });
const ptext = (t) => p(text(t));
const h = (level, t) => ({ type: 'heading', level, children: [text(t)] });
const li = (...children) => ({ type: 'list-item', children: children.length ? children : [text('')] });
const ul = (items) => ({
  type: 'list',
  format: 'unordered',
  children: items.map((i) => (typeof i === 'string' ? li(text(i)) : i)),
});

// --- 1. the `blogs` page ----------------------------------------------------
const { data: pages } = await adapter.query('page', DRAFT);
let blogsPage = pages.find((x) => x.key === 'blogs');

if (blogsPage) {
  console.log('page "blogs": already exists — left untouched.');
} else {
  const meta = await createPublished('meta-data', {
    title: 'Renovation advice & project stories',
    description:
      'Practical guides and behind-the-scenes write-ups from our building, kitchen, bathroom and refurbishment work across North London.',
  });
  const hero = await createPublished('page-hero', {
    breadcrumbLabel: 'Blog',
    overline: 'Advice & stories',
    title: 'Renovation advice & project stories',
    subtitle:
      'What we have learned on site — planning, costs, materials and the things worth getting right the first time.',
  });
  blogsPage = await createPublished('page', {
    key: 'blogs',
    title: 'Blog',
    description: 'Renovation advice and project stories from Upper Street Contractors.',
    meta: meta.__id,
    sections: [hero.__id],
  });
  console.log('page "blogs": created with a Page Hero.');
}

// --- 2. sample posts --------------------------------------------------------
const POSTS = [
  {
    slug: 'planning-a-wetroom-conversion',
    title: 'Planning a wetroom conversion: what to sort before the tiles',
    excerpt:
      'Falls, drainage and tanking decide whether a wetroom works. Here is the order we tackle them in, and where the money actually goes.',
    category: 'Bathrooms',
    publishedAt: '2026-07-14',
    sections: [
      {
        type: 'prose-section',
        values: {
          overline: 'Where to start',
          body: [
            h(2, 'Get the drainage sorted first'),
            ptext(
              'A wetroom lives or dies on where the water goes. Before anyone talks about tiles, we work out where the waste can run and how much floor build-up that needs — on a suspended timber floor that usually means cutting into joists, which is a structural decision, not a finish one.'
            ),
            h(2, 'Then the tanking'),
            ptext(
              'Tanking is the waterproof layer under everything. It is invisible when the job is done, which is exactly why it is the first thing skipped on a cheap quote. We tank the whole shower zone and 150mm beyond it, up the walls, with taped joints at every corner.'
            ),
            h(3, 'What we always specify'),
            ul([
              'A linear channel drain rather than a centre gully where the floor allows it.',
              'A pre-formed sloped tray on timber floors — far more reliable than a screed fall.',
              'Underfloor heating, because a wetroom floor stays wet without it.',
            ]),
          ],
        },
      },
      {
        type: 'quote-section',
        values: {
          quote:
            'The tanking and the fall are 80% of whether a wetroom still works in five years. Everything else is decoration.',
          attribution: 'Our site manager, on every bathroom job',
        },
      },
      { type: 'separator-section', values: { variant: 'line' } },
      {
        type: 'prose-section',
        values: {
          overline: 'Budget',
          body: [
            h(2, 'What it costs'),
            ptext(
              'A straightforward wetroom conversion in a North London flat typically lands between £8k and £14k depending on the drainage work, the tiling and whether the room is being reconfigured. The variable is almost never the sanitaryware.'
            ),
          ],
        },
      },
    ],
  },
  {
    slug: 'kitchen-extension-timeline',
    title: 'How long a kitchen extension really takes',
    excerpt:
      'A realistic week-by-week timeline for a single-storey rear extension, including the bits that always slip.',
    category: 'Kitchens',
    publishedAt: '2026-06-28',
    sections: [
      {
        type: 'prose-section',
        values: {
          overline: 'Timeline',
          body: [
            h(2, 'Twelve to sixteen weeks on site'),
            ptext(
              'That is the honest range for a single-storey rear extension with a new kitchen in it, assuming drawings are approved and the party wall agreement is in place before we start. The two things that most often add weeks are steel fabrication lead times and a building control inspection that has to be rebooked.'
            ),
            h(3, 'Roughly how it splits'),
            ul([
              'Weeks 1–3: groundworks, foundations, drainage diversions.',
              'Weeks 4–6: blockwork and the steel goes in.',
              'Weeks 7–9: roof, glazing, made watertight.',
              'Weeks 10–13: first fix, plaster, screed.',
              'Weeks 14–16: kitchen fit, second fix, snagging.',
            ]),
          ],
        },
      },
      {
        type: 'prose-section',
        values: {
          overline: 'Planning ahead',
          body: [
            h(2, 'Order the kitchen earlier than feels sensible'),
            ptext(
              'Most kitchen suppliers quote 8–10 weeks from final sign-off, and that clock only starts once every appliance is confirmed. Choosing the kitchen in week 2 rather than week 10 is the single easiest way to avoid a finished shell with nothing to put in it.'
            ),
          ],
        },
      },
    ],
  },
  {
    slug: 'when-rewiring-is-worth-it',
    title: 'When a rewire is worth it — and when it is not',
    excerpt:
      'Old wiring is not automatically unsafe. Here is how we decide between a full rewire, a partial, and simply upgrading the board.',
    category: 'Electrical',
    publishedAt: '2026-05-19',
    sections: [
      {
        type: 'prose-section',
        values: {
          overline: 'Assessment',
          body: [
            h(2, 'Start with an EICR, not a quote'),
            ptext(
              'An Electrical Installation Condition Report tells you what is actually wrong. Plenty of houses we look at have perfectly serviceable cabling behind an ancient consumer unit — replacing the board and adding RCD protection costs a fraction of a rewire and fixes the real risk.'
            ),
            h(2, 'When a full rewire is the right call'),
            ul([
              'Rubber or fabric-insulated cable anywhere in the property.',
              'No earth on the lighting circuits.',
              'You are already taking floors up and walls back for other work.',
            ]),
            ptext(
              'That last one matters more than people expect. The cost of a rewire is mostly access — doing it while the house is already open is far cheaper than coming back for it.'
            ),
          ],
        },
      },
      { type: 'separator-section', values: { variant: 'dots' } },
      {
        type: 'quote-section',
        values: {
          quote: 'If the floors are up anyway, rewire. If they are not, fix the board and test.',
          attribution: 'Rule of thumb we give every client',
        },
      },
    ],
  },
];

const { data: existingPosts } = await adapter.query('blog-post', DRAFT);
const takenSlugs = new Map(existingPosts.map((p) => [p.slug, p.__id]));

for (const post of POSTS) {
  if (takenSlugs.has(post.slug)) {
    console.log(`post "${post.slug}": already exists — skipped.`);
    continue;
  }

  const sectionIds = [];
  for (const section of post.sections) {
    const created = await createPublished(section.type, section.values);
    sectionIds.push(created.__id);
  }

  const meta = await createPublished('meta-data', {
    title: post.title,
    description: post.excerpt,
  });

  await createPublished('blog-post', {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    publishedAt: post.publishedAt,
    sections: sectionIds,
    meta: meta.__id,
  });
  console.log(`post "${post.slug}": created with ${sectionIds.length} sections.`);
}

console.log(dryRun ? 'seed-blogs-content: dry run complete.' : 'seed-blogs-content: done.');
