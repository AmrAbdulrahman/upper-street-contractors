/**
 * Seed the Services index — `/services`.
 *
 * The nine Service pages have always existed, but only ever as nine links in
 * the header row. That row could hold nothing else, so the site had no Home,
 * Projects, About or Contact link in its main nav at all. Moving the nine into
 * a Services dropdown needs somewhere for "Services" itself to point, and a
 * footer that no longer lists nine trades needs a hub that does.
 *
 * Built as a section block rather than a bespoke route: `service-grid-section`
 * is a normal Type in `page.sections`, so `/services` is the same seven-line
 * `<PageSections>` file as every Service page, the Section builder can reorder
 * it, and the block can be dropped on the home page later with no new code.
 *
 * Card images reuse existing **project heroes**, matched by Category — a
 * Kitchens card gets a real kitchen. (The plan said page-hero, but `page-hero`
 * carries no asset field; it is breadcrumb/overline/title/subtitle/buttons.)
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Schema changes are additive only,
 * so `saveSchema`'s destructive-edit guard passes. Idempotent throughout: the
 * Type edits are skipped when present, cards are matched by `href`, and the
 * page is skipped once it exists. Run `nx cms-schema website --skip-nx-cache &&
 * nx codegen website --skip-nx-cache` afterwards, then restart `next dev`.
 *
 * Usage:
 *   node scripts/seed-services-index.mjs --schema-only
 *   node scripts/seed-services-index.mjs
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
  if (!v) throw new Error(`seed-services-index: ${name} is required`);
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

const ACTOR = 'seed:services-index';
const CARD = 'service-card';
const GRID = 'service-grid-section';
const PAGE_KEY = 'services';

/**
 * One row per Service page. `category` is the Project Category tag used to find
 * a hero photo — note Electric's is "Electrical", which is why this is a table
 * and not a slugify().
 */
const SERVICES = [
  {
    href: '/refurbishments',
    title: 'Refurbishments',
    category: 'Refurbishment',
    summary:
      'Whole-home and single-room refurbishments, managed end to end by one owner-led team — from first survey to final sign-off.',
  },
  {
    href: '/kitchens',
    title: 'Kitchens',
    category: 'Kitchen',
    summary:
      'Kitchen installation and refurbishment, including the plumbing, electrics and carpentry a new layout needs.',
  },
  {
    href: '/bathrooms',
    title: 'Bathrooms',
    category: 'Bathroom',
    summary:
      'Bathroom renovations and wetroom conversions, waterproofed and tiled to last rather than to photograph well once.',
  },
  {
    href: '/plumbing',
    title: 'Plumbing',
    category: 'Plumbing',
    summary:
      'Leaks, pipework, bathroom and kitchen plumbing — repairs booked by the visit, installations quoted as a project.',
  },
  {
    href: '/heating',
    title: 'Heating',
    category: 'Heating',
    summary:
      'Boilers, radiators and central heating by Gas Safe registered engineers, serviced and installed across North London.',
  },
  {
    href: '/electric',
    title: 'Electric',
    category: 'Electrical',
    summary:
      'Rewires, consumer units, lighting and fault-finding by NICEIC approved contractors, certified on completion.',
  },
  {
    href: '/carpentry',
    title: 'Carpentry',
    category: 'Carpentry',
    summary:
      'Fitted storage, doors, flooring and bespoke joinery — made to fit the room you have, not the one a catalogue assumed.',
  },
  {
    href: '/roofing',
    title: 'Roofing',
    category: 'Roofing',
    summary:
      'Roof repairs, flat roofs, gutters and leadwork, with the access equipment and insurance the job actually requires.',
  },
  {
    href: '/handyman',
    title: 'Handyman',
    category: 'Handyman',
    summary:
      'Multi-trade repairs, odd jobs and general maintenance, booked by the hour for the work too small to quote.',
  },
];

// --- 1. schema (additive, idempotent) ---------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let schemaChanged = false;

const CARD_FIELDS = [
  {
    __name: 'title',
    __type: 'text',
    label: 'Title',
    description: 'The service name, as it should read on the card.',
  },
  {
    __name: 'summary',
    __type: 'longtext',
    label: 'Summary',
    description: 'One or two plain sentences. Clamped to three lines on the card.',
  },
  {
    __name: 'image',
    __type: 'asset',
    accept: 'image',
    label: 'Image',
    description: 'The photo behind the card heading.',
  },
  {
    __name: 'href',
    __type: 'text',
    label: 'Link',
    description: 'Where the card goes — the Service page path, e.g. /kitchens.',
  },
];

const GRID_FIELDS = [
  { __name: 'overline', __type: 'text', label: 'Overline' },
  { __name: 'title', __type: 'text', label: 'Title' },
  {
    __name: 'cards',
    __type: 'references',
    allowedTypes: [CARD],
    label: 'Cards',
    description: 'The services shown in the grid, in order.',
  },
];

function upsertType(name, label, description, fields, thumbnail) {
  const idx = nextSchema.findIndex((t) => t.__name === name);

  if (idx === -1) {
    nextSchema.push({ __name: name, label, description, thumbnail, fields });
    schemaChanged = true;
    console.log(`schema: added Type "${name}"`);
    return;
  }

  if (JSON.stringify(nextSchema[idx].fields) !== JSON.stringify(fields)) {
    nextSchema[idx] = { ...nextSchema[idx], label, description, thumbnail, fields };
    schemaChanged = true;
    console.log(`schema: reconciled Type "${name}"`);
  }
}

upsertType(
  CARD,
  'Service Card',
  'One service in a Service grid: photo, name, summary and a link to its page.',
  CARD_FIELDS,
  'imageText'
);

upsertType(
  GRID,
  'Service Grid',
  'A grid of Service Cards, each linking to that service’s own page.',
  GRID_FIELDS,
  'cardList'
);

// Allowed on a page's sections AND a Blog Post's — the two lists are separate
// snapshots, and a Type missing from one is simply unpickable there.
for (const host of ['page', 'blog-post']) {
  const hostType = nextSchema.find((t) => t.__name === host);
  if (!hostType) {
    console.warn(`  ! no "${host}" Type in schema — skipping allowedTypes`);
    continue;
  }

  const sections = hostType.fields.find((f) => f.__name === 'sections');
  if (!sections) {
    console.warn(`  ! "${host}" has no "sections" field — skipping`);
    continue;
  }

  sections.allowedTypes = sections.allowedTypes ?? [];
  if (!sections.allowedTypes.includes(GRID)) {
    sections.allowedTypes.push(GRID);
    schemaChanged = true;
    console.log(`schema: added "${GRID}" to ${host}.sections allowedTypes`);
  }
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

if (schemaOnly) {
  console.log('seed-services-index: --schema-only, done.');
  process.exit(0);
}

// --- 2. image pool, matched by Category -------------------------------------
const projects = await adapter.query('project', { page: { limit: 500 } });
const heroesByCategory = new Map();
for (const project of projects.data) {
  if (!project.hero || !project.category) continue;
  const bucket = heroesByCategory.get(project.category) ?? [];
  bucket.push(project.hero);
  heroesByCategory.set(project.category, bucket);
}

const fallbackImages = [
  ...new Set(projects.data.map((p) => p.hero).filter((h) => typeof h === 'string')),
];

function imageFor(category) {
  const matched = heroesByCategory.get(category);
  if (matched?.length) return matched[0];
  // A service with no Project of its own Category yet still needs a photo.
  return fallbackImages[0] ?? null;
}

// --- 3. cards (idempotent by href) ------------------------------------------
const existingCards = await adapter.query(CARD, {
  page: { limit: 200 },
  status: 'draft',
  includeUnpublished: true,
});
const cardByHref = new Map(existingCards.data.map((c) => [c.href, c]));

const cardIds = [];
for (const service of SERVICES) {
  const existing = cardByHref.get(service.href);

  if (existing) {
    cardIds.push(existing.__id);
    console.log(`  = card ${service.href}: exists`);
    continue;
  }

  const created = await adapter.create(
    CARD,
    {
      title: service.title,
      summary: service.summary,
      image: imageFor(service.category),
      href: service.href,
    },
    ACTOR
  );

  const published = await adapter.publish(CARD, created.__id, ACTOR, created.__lastEditedAt);
  cardIds.push(published.__id);
  console.log(`  + card ${service.href}`);
}

// --- 4. the page (idempotent by key) ----------------------------------------
const existingPage = await adapter.query('page', {
  where: { key: { eq: PAGE_KEY } },
  page: { limit: 1 },
  status: 'draft',
  includeUnpublished: true,
});

if (existingPage.data[0]) {
  console.log(`page "${PAGE_KEY}": already exists — leaving its sections alone.`);
  console.log('seed-services-index: done.');
  process.exit(0);
}

async function createPublished(type, values) {
  const created = await adapter.create(type, values, ACTOR);
  const published = await adapter.publish(type, created.__id, ACTOR, created.__lastEditedAt);
  return published.__id;
}

const metaId = await createPublished('meta-data', {
  title: 'Our Services',
  description:
    'Refurbishments, kitchens, bathrooms, plumbing, heating, electrics, carpentry, roofing and handyman work across Islington and North London.',
});

const heroId = await createPublished('page-hero', {
  breadcrumbLabel: 'Services',
  overline: 'What we do',
  title: 'Our Services',
  subtitle:
    'Nine trades under one roof, run by one team. Whatever the job needs, you deal with the same people from the first visit to the last.',
});

const gridId = await createPublished(GRID, {
  overline: 'Choose a service',
  title: 'Every trade we cover',
  cards: cardIds,
});

// Every CTA band on the site points at the SAME two button entries (Request a
// Quote + WhatsApp Us) — shared on purpose, so changing the wording once
// changes it everywhere. Borrow them rather than minting a third pair that
// would then drift.
const ctaButtons = await adapter.query('planning-renovation-section', {
  page: { limit: 20 },
});
const sharedButtons =
  ctaButtons.data.find((s) => (s.buttons ?? []).length === 2)?.buttons ?? [];

if (sharedButtons.length === 0) {
  console.warn('  ! no existing CTA band to borrow buttons from — band will have none');
}

const ctaId = await createPublished('planning-renovation-section', {
  overline: '',
  title: 'Not sure which service you need?',
  description:
    'Tell us what you are trying to achieve and we will tell you which trades it takes. Site visits and quotes are free.',
  buttons: sharedButtons,
});

const pageId = await createPublished('page', {
  key: PAGE_KEY,
  title: 'Our Services',
  description: 'Refurbishments, kitchens, bathrooms and every trade in between.',
  meta: metaId,
  sections: [heroId, gridId, ctaId],
});

console.log(`page "${PAGE_KEY}": created (${pageId}) with hero + grid + CTA.`);
console.log('seed-services-index: done.');
console.log('next: nx cms-schema website --skip-nx-cache && nx codegen website --skip-nx-cache, then restart next dev.');
