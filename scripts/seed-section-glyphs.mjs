/**
 * Schema seed (idempotent): give every section Type a Thumbnail glyph of its own.
 *
 * The Type picker's glyph is the biggest thing in a cell, and until now it was
 * the least informative: 24 section Types shared 12 keys, with `cardList` alone
 * standing for What We Do, Why Choose Us, How It Works, Recent Work, Case
 * Studies and Service Grid. Six identical cells is the picker telling an editor
 * to read the labels instead.
 *
 * The two wizard Question Types are here for the same reason from the other
 * direction: `wizard.questions` is the only other picker that offers a choice,
 * and both its cells fell through to GENERIC_GLYPH — two identical dashed boxes.
 *
 * Only `thumbnail` moves. No Type, field or entry is touched, so
 * `Engine.saveSchema`'s destructive-edit guard has nothing to refuse, and the
 * GraphQL SDL is unaffected (`thumbnail` is CMS-side presentation, never a
 * queryable field) — no codegen re-run is needed.
 *
 * Every value below must be a key in TYPE_GLYPHS
 * (libs/zero-cms-app/src/lib/components/type-glyphs/type-glyphs.tsx). An unknown
 * key does not error; it silently falls back to the generic frame, which is the
 * thing this seed exists to remove.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008) — schema only.
 *
 * Same harness as scripts/seed-blogs-schema.mjs.
 *
 * Usage: node scripts/seed-section-glyphs.mjs
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
  if (!v) throw new Error(`seed-section-glyphs: ${name} is required`);
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

const ACTOR = 'seed:section-glyphs';

/**
 * Type `__name` -> TYPE_GLYPHS key. The ten section Types whose glyph was
 * already theirs alone are listed too, so this file is the whole picture rather
 * than a diff against a state nobody can see — and so re-running it after
 * someone edits a thumbnail in the type-builder puts it back.
 */
const GLYPHS = {
  // --- unchanged: already unique among the section Types ---
  'page-hero': 'hero',
  wizard: 'form',
  'clients-carousel': 'logoStrip',
  'quote-section': 'quote',
  'prose-section': 'richText',
  faq: 'faq',
  'image-section': 'image',
  'gallery-section': 'gallery',
  'separator-section': 'separator',
  'planning-renovation-section': 'cta',

  // --- freed from a shared glyph ---
  'home-header-section': 'homeHero', // was hero, with page-hero
  'contact-details': 'contactCard', // was form, with wizard
  'who-we-are-section': 'whoWeAre', // was imageText
  'service-offer-section': 'serviceOffer', // was imageText
  'split-section': 'splitImage', // was imageText
  'accreditation-list': 'accreditations', // was logoStrip, with clients-carousel
  'what-we-do-section': 'whatWeDo', // was cardList
  'why-choose-us-section': 'whyChooseUs', // was cardList
  'how-it-works-section': 'howItWorks', // was cardList
  'recent-work-section': 'recentWork', // was cardList
  'case-studies-section': 'caseStudies', // was cardList
  'service-grid-section': 'serviceGrid', // was cardList
  'client-review-section': 'reviews', // was quote, with quote-section
  'google-reviews': 'googleReviews', // was quote, with quote-section

  // --- the wizard's own picker: two cells that were both the generic frame ---
  'image-question': 'imageQuestion',
  'form-question': 'formQuestion',
};

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));
let changed = false;

const byName = (name) => next.find((t) => t.__name === name);

for (const [name, thumbnail] of Object.entries(GLYPHS)) {
  const type = byName(name);
  if (!type) throw new Error(`seed-section-glyphs: no "${name}" Type in schema`);
  if (type.thumbnail === thumbnail) continue;
  console.log(`schema: ${name}.thumbnail ${type.thumbnail ?? '(none)'} -> ${thumbnail}`);
  type.thumbnail = thumbnail;
  changed = true;
}

// The point of the whole exercise: two section Types sharing a glyph is the bug.
// Assert it before saving rather than discovering it in the picker.
const sectionTypes =
  byName('page')?.fields.find((f) => f.__name === 'sections')?.allowedTypes ?? [];
const seen = new Map();
for (const name of sectionTypes) {
  const thumbnail = byName(name)?.thumbnail;
  if (!thumbnail) throw new Error(`seed-section-glyphs: "${name}" has no thumbnail`);
  const owner = seen.get(thumbnail);
  if (owner)
    throw new Error(
      `seed-section-glyphs: "${name}" and "${owner}" both use the "${thumbnail}" glyph`
    );
  seen.set(thumbnail, name);
}
console.log(`schema: ${sectionTypes.length} section Types, ${seen.size} distinct glyphs.`);

if (changed) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

console.log('seed-section-glyphs: done.');
