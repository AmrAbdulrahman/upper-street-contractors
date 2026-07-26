/**
 * Schema seed (idempotent) for the Blog feature + the Section builder.
 *
 *   1. `blog-post` — the Blog Post Type: listing fields (title / slug / excerpt /
 *      hero / author / publishedAt / category) plus a `sections` One-to-Many
 *      sharing the same allowedTypes as `page.sections`. Reshaped in place when
 *      it already exists, so field order and kinds converge on one definition.
 *   2. Four new section Types (+ the `figure` child a Gallery section holds):
 *      image-section, gallery-section, quote-section, separator-section.
 *   3. Those four appended to `page.sections` allowedTypes, so they join the
 *      PageSectionsRef union and can be used on ordinary pages too.
 *   4. Type-level `label` / `description` / `thumbnail` on every Type that is
 *      pickable as a section — the Section builder's Type picker renders exactly
 *      these three (see TYPE_GLYPHS in @usc/zero-cms-app for the glyph keys).
 *
 * Everything except the `blog-post` reshape is additive. The reshape drops `meta`
 * and re-kinds `author`, which `Engine.saveSchema`'s destructive-edit guard WILL
 * refuse while any published post still stores those keys — so
 * `scripts/migrate-blog-author-and-meta.mjs` has to run first.
 * WRITES TO THE SHARED LIVE Redis (ADR 0008) — but schema only; no entries are
 * created here (see seed-blogs-content.mjs).
 *
 * Same harness as scripts/seed-faq-timing-schema.mjs.
 *
 * Usage: node scripts/seed-blogs-schema.mjs
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
  if (!v) throw new Error(`seed-blogs-schema: ${name} is required`);
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

const ACTOR = 'seed:blogs';

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let changed = false;

const byName = (name) => next.find((t) => t.__name === name);

function addType(type) {
  if (byName(type.__name)) return false;
  next.push(type);
  changed = true;
  console.log(`schema: added Type "${type.__name}"`);
  return true;
}

/**
 * Stamp the three Type-level presentation keys the Type picker reads. Applied to
 * pre-existing Types too (they have none yet), which is why this is a patch
 * rather than part of the Type literals.
 */
function setMeta(name, { label, description, thumbnail }) {
  const t = byName(name);
  if (!t) throw new Error(`seed-blogs-schema: no "${name}" Type in schema`);
  for (const [key, value] of Object.entries({ label, description, thumbnail })) {
    if (value != null && t[key] !== value) {
      t[key] = value;
      changed = true;
      console.log(`schema: ${name}.${key} = ${JSON.stringify(value)}`);
    }
  }
}

// --- 1. New section Types ---------------------------------------------------

// `figure` is the Gallery section's child. Deliberately NOT a reuse of
// `project-image`, whose glossary meaning is "photos on a Project's detail
// page" — renaming that Type would read as replacing it (schema.ts: a Type's
// only stable identity is __name), so a distinct Type is the honest move.
addType({
  __name: 'figure',
  label: 'Figure',
  description: 'One captioned photo inside a Gallery.',
  fields: [
    { __name: 'image', __type: 'asset', accept: 'image', label: 'Image', required: true },
    { __name: 'caption', __type: 'text', label: 'Caption' },
  ],
});

addType({
  __name: 'image-section',
  label: 'Image',
  description: 'A single photo with an optional caption.',
  thumbnail: 'image',
  fields: [
    { __name: 'image', __type: 'asset', accept: 'image', label: 'Image', required: true },
    { __name: 'caption', __type: 'text', label: 'Caption' },
    {
      __name: 'width',
      __type: 'lookup',
      label: 'Width',
      options: ['narrow', 'wide', 'full'],
      default: 'wide',
    },
  ],
});

addType({
  __name: 'gallery-section',
  label: 'Gallery',
  description: 'A grid of captioned photos.',
  thumbnail: 'gallery',
  fields: [
    { __name: 'title', __type: 'text', label: 'Title' },
    { __name: 'images', __type: 'references', label: 'Photos', allowedTypes: ['figure'] },
    { __name: 'columns', __type: 'number', label: 'Columns', integer: true, min: 2, max: 4, default: 3 },
  ],
});

addType({
  __name: 'quote-section',
  label: 'Quote',
  description: 'A pull-quote with attribution.',
  thumbnail: 'quote',
  fields: [
    { __name: 'quote', __type: 'longtext', label: 'Quote', required: true },
    { __name: 'attribution', __type: 'text', label: 'Attributed to' },
  ],
});

addType({
  __name: 'separator-section',
  label: 'Separator',
  description: 'A visual break between blocks.',
  thumbnail: 'separator',
  fields: [
    {
      __name: 'variant',
      __type: 'lookup',
      label: 'Style',
      options: ['line', 'space', 'dots'],
      default: 'line',
    },
  ],
});

// --- 2. Type picker meta on the sections reused from the existing site ------
setMeta('prose-section', {
  label: 'Rich Text',
  description: 'Headings and paragraphs in a reading column.',
  thumbnail: 'richText',
});
setMeta('split-section', {
  label: 'Image with Text',
  description: 'A photo beside a block of rich text.',
  thumbnail: 'imageText',
});
setMeta('faq', {
  label: 'FAQ',
  description: 'Questions and answers as an accordion.',
  thumbnail: 'faq',
});
setMeta('planning-renovation-section', {
  label: 'Call to Action',
  description: 'A prompt with WhatsApp and quote buttons.',
  thumbnail: 'cta',
});

// The remaining page sections aren't blog-shaped, but they're all pickable on a
// `page`, so give them glyphs too rather than a grid of identical placeholders.
const OTHER_SECTION_META = {
  'page-hero': ['Page Hero', 'Breadcrumb, title and subtitle banner.', 'hero'],
  'home-header-section': ['Home Hero', 'The home page hero with its at-a-glance panel.', 'hero'],
  'who-we-are-section': ['Who We Are', 'Title, rich text, image and buttons.', 'imageText'],
  'what-we-do-section': ['What We Do', 'The services grid.', 'cardList'],
  'why-choose-us-section': ['Why Choose Us', 'Reasons as a card list.', 'cardList'],
  'how-it-works-section': ['How It Works', 'Numbered steps.', 'cardList'],
  'recent-work-section': ['Recent Work', 'Curated project cards.', 'cardList'],
  'client-review-section': ['Client Reviews', 'Testimonials with star ratings.', 'quote'],
  'case-studies-section': ['Case Studies', 'Projects matching a category.', 'cardList'],
  'clients-carousel': ['Clients Carousel', 'A rotating strip of client logos.', 'logoStrip'],
  'accreditation-list': ['Accreditations', 'Trust badges beside the Trustpilot widget.', 'logoStrip'],
  'google-reviews': ['Google Reviews', 'The Google reviews embed.', 'quote'],
  'contact-details': ['Contact Details', 'Ways to reach the company.', 'form'],
  wizard: ['Enquiry Wizard', 'The stepped enquiry form.', 'form'],
  'service-offer-section': ['Service Offer', 'What we deliver, with cost cards.', 'imageText'],
};
for (const [name, [label, description, thumbnail]] of Object.entries(OTHER_SECTION_META)) {
  // Skip silently: this list is a convenience, not a contract, and a Type that
  // has since been retired must not fail the whole seed.
  if (byName(name)) setMeta(name, { label, description, thumbnail });
  else console.log(`schema: skipped meta for missing Type "${name}"`);
}

// --- 3. page.sections allowedTypes += the four new sections -----------------
const NEW_SECTIONS = ['image-section', 'gallery-section', 'quote-section', 'separator-section'];

const pageType = byName('page');
if (!pageType) throw new Error('seed-blogs-schema: no "page" Type in schema');
const pageSections = (pageType.fields ?? []).find((f) => f.__name === 'sections');
if (!pageSections) throw new Error('seed-blogs-schema: "page" has no "sections" field');
pageSections.allowedTypes = pageSections.allowedTypes ?? [];
for (const s of NEW_SECTIONS) {
  if (!pageSections.allowedTypes.includes(s)) {
    pageSections.allowedTypes.push(s);
    changed = true;
    console.log(`schema: added "${s}" to page.sections allowedTypes`);
  }
}

// --- 4. blog-post ----------------------------------------------------------

// A Blog Post's own sections accept everything a page section does. Snapshotted
// from page.sections (post-step-3) rather than hand-listed, so the two unions
// can't silently diverge as sections are added.
const BLOG_SECTIONS = [...pageSections.allowedTypes];

/**
 * The canonical `blog-post` field list — declared once and applied whether the
 * Type is being created or reshaped, so there is no "new install vs upgrade"
 * divergence to reason about.
 *
 * Field ORDER is the Edit-drawer order (`EntryForm` maps `type.fields`), which is
 * why `title` comes first: the slug derives from it, and a form that asks for the
 * URL before the headline reads backwards.
 *
 * Three deliberate kinds:
 *  - `slug` (not `text`) — pattern-validated by core, and derived from `title`
 *    until an editor touches it, then detached for good so rewording a headline
 *    never moves a URL that has already been shared.
 *  - `user` (not a relation to an `author` entry) — stores the chosen CMS user's
 *    display name. Accounts live outside the entry store, so a live link would
 *    mean a public read path over `users.json` just to print a byline. ADR 0016.
 *  - no `meta` at all — a post's metadata is DERIVED from its title and excerpt
 *    (see `blog/[slug]/page.tsx`), never picked, so there is nothing to pick.
 */
const BLOG_POST_FIELDS = () => [
  { __name: 'title', __type: 'text', label: 'Title', required: true },
  // No unique constraint exists in zero-cms — the route resolves the first
  // match, so a duplicate slug silently shadows a post.
  {
    __name: 'slug',
    __type: 'slug',
    label: 'URL slug',
    required: true,
    from: 'title',
    description: 'Lowercase words joined by hyphens. Becomes /blog/<slug>.',
  },
  {
    __name: 'excerpt',
    __type: 'longtext',
    label: 'Excerpt',
    description: 'Shown on the index card, and used as the page description for search results.',
  },
  { __name: 'hero', __type: 'asset', accept: 'image', label: 'Hero image' },
  { __name: 'author', __type: 'user', label: 'Author' },
  { __name: 'publishedAt', __type: 'date', label: 'Published on' },
  {
    __name: 'category',
    __type: 'lookup',
    label: 'Category',
    options: [
      'Kitchens',
      'Bathrooms',
      'Refurbishments',
      'Plumbing',
      'Heating',
      'Electrical',
      'Carpentry',
      'Roofing',
      'Guides',
      'News',
    ],
  },
  { __name: 'sections', __type: 'references', label: 'Sections', allowedTypes: BLOG_SECTIONS },
];

if (
  !addType({
    __name: 'blog-post',
    label: 'Blog Post',
    description: 'One article on /blog.',
    thumbnail: 'richText',
    fields: BLOG_POST_FIELDS(),
  })
) {
  // Already present from an earlier run. Reshape it to the canonical list above,
  // carrying over the sections union it already had (so a section Type added by
  // a later seed isn't dropped) plus anything new from page.sections.
  const existing = byName('blog-post');
  const previousSections = (existing.fields ?? []).find((f) => f.__name === 'sections');
  const union = [...new Set([...(previousSections?.allowedTypes ?? []), ...BLOG_SECTIONS])];

  const next = BLOG_POST_FIELDS();
  next.find((f) => f.__name === 'sections').allowedTypes = union;

  if (JSON.stringify(existing.fields) !== JSON.stringify(next)) {
    const before = new Set((existing.fields ?? []).map((f) => `${f.__name}:${f.__type}`));
    const after = new Set(next.map((f) => `${f.__name}:${f.__type}`));
    for (const gone of [...before].filter((f) => !after.has(f)))
      console.log(`schema: blog-post dropped/changed field ${gone}`);
    for (const added of [...after].filter((f) => !before.has(f)))
      console.log(`schema: blog-post now has field ${added}`);
    existing.fields = next;
    existing.description = 'One article on /blog.';
    changed = true;
    console.log('schema: blog-post fields reshaped (order + kinds).');
  }
}

// Sanity-check the relation target exists before we save a dangling union.
// `author` is no longer among them — a Blog Post's author is a `user` name now,
// though the `author` Type itself stays: `project.author` still points at it.
for (const required of ['meta-data']) {
  if (!byName(required))
    throw new Error(`seed-blogs-schema: "${required}" is not in the schema`);
}

// --- save -------------------------------------------------------------------
if (changed) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

console.log('seed-blogs-schema: done.');
