/**
 * Seed a 3-question FAQ section onto each of the 9 nav service pages, inserted
 * immediately BEFORE that page's Case Studies section (so it sits directly above
 * Case Studies, after any Split Sections). Each page gets its own trade-specific
 * trio — no copy is reused across pages.
 *
 * The `faq` / `faq-item` Types and the `page.sections` allowedTypes += faq were
 * already applied by scripts/seed-faq-timing-schema.mjs (About-page FAQ). This
 * script is CONTENT ONLY, but defensively re-adds `faq` to allowedTypes if it's
 * somehow missing (idempotent, additive → passes saveSchema's destructive guard).
 *
 * Entries are created AND PUBLISHED immediately (same as scripts/seed-split-
 * sections.mjs). WRITES TO THE SHARED LIVE STORE (ADR 0008). Idempotent: any
 * page that already carries a `faq` section is skipped — a re-run cannot
 * double-insert.
 *
 * Same harness as scripts/seed-split-sections.mjs.
 *
 * Usage: node scripts/seed-faq-service-pages.mjs
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
  if (!v) throw new Error(`seed-faq-service-pages: ${name} is required`);
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

const ACTOR = 'seed:faq-service-pages';

// Strapi-blocks paragraph (what RichTextViewer / ZeroCmsBlocks render).
const p = (text) => ({ type: 'paragraph', children: [{ type: 'text', text }] });

// --- per-page content: 3 unique, service-specific Q&As each ------------------
// Keyed by CMS page key, in nav order. Tone matches the existing About FAQ
// (Islington / North London, owner-led, honest-quote).
const FAQ_BY_PAGE = {
  'home-refurbishments-service': [
    {
      q: 'What does a full home refurbishment include?',
      a: 'From structural work, plastering and rewiring to new kitchens, bathrooms and decoration — we manage the whole project end to end, so you deal with one owner-led team from first survey to final sign-off.',
    },
    {
      q: 'Can we stay in the house while you work?',
      a: 'Often yes for a phased refurbishment — we sequence the work around you, protect finished areas and clean the site daily. For larger structural jobs it can be simpler to move out; we advise honestly at the survey.',
    },
    {
      q: 'How long does a full refurbishment take?',
      a: 'Most whole-house refurbishments run six to twelve weeks depending on size and scope. We agree a realistic programme up front and keep you updated at every stage.',
    },
  ],
  'kitchen-installations-service': [
    {
      q: 'Do you supply the kitchen or fit one I have bought?',
      a: 'Both. We can design and supply the full kitchen, or install a unit you have bought from anywhere — including the plumbing, electrics, tiling and worktops.',
    },
    {
      q: 'Can you handle worktops, splashbacks and appliances too?',
      a: 'Yes — we fit laminate, solid timber, quartz and granite worktops, tile or glass splashbacks, and connect all appliances, so the kitchen is finished and working when we leave.',
    },
    {
      q: 'How long does a kitchen installation take?',
      a: 'A straightforward replacement is usually one to two weeks; a full redesign with a new layout, moved services or a knock-through takes longer. We give you a firm timeline before we start.',
    },
  ],
  'bathroom-renovations-service': [
    {
      q: 'Can you fit a wetroom or walk-in shower?',
      a: 'Yes — we build fully tanked wetrooms and level-access showers, including the waterproofing, drainage and underfloor heating, not just the visible finishes.',
    },
    {
      q: 'Do you handle tiling, plumbing and electrics in-house?',
      a: 'We do — one team covers the plumbing, first-fix electrics, tiling and finishing, so there is no juggling separate trades and no gaps between them.',
    },
    {
      q: 'How long does a bathroom take?',
      a: 'A typical bathroom renovation is one to two weeks. We agree the timeline up front, protect the rest of your home and tidy the site at the end of each day.',
    },
  ],
  'plumbing-service': [
    {
      q: 'Do you handle emergency plumbing?',
      a: 'Yes — for leaks, burst pipes and failed hot water we aim to respond the same day wherever we can. Call us and we will tell you honestly how quickly we can reach you.',
    },
    {
      q: 'Are your plumbers Gas Safe registered?',
      a: 'Any gas work is carried out by Gas Safe registered engineers, and we hold the relevant plumbing and heating accreditations. We are happy to share certificates on request.',
    },
    {
      q: 'Do you only install, or repairs too?',
      a: 'Both — from fixing a dripping tap or clearing a blocked waste to installing full bathrooms, boilers and pipework. No job is too small.',
    },
  ],
  'heating-service': [
    {
      q: 'Do you install and replace boilers?',
      a: 'Yes — we supply and fit combi, system and conventional boilers, sized correctly for your home, and remove the old unit as part of the job. All gas work is done by Gas Safe engineers.',
    },
    {
      q: 'Can you add or move radiators?',
      a: 'We install, move and upgrade radiators and towel rails, balance the system, and can fit smart thermostats and zoned controls to cut your running costs.',
    },
    {
      q: 'What is a power flush and do I need one?',
      a: 'A power flush clears sludge and debris from your radiators and pipework to restore even heat and protect a new boiler. We will tell you if yours would genuinely benefit — not sell you one you do not need.',
    },
  ],
  'electric-service': [
    {
      q: 'Are you NICEIC-registered electricians?',
      a: 'Yes — our electrical work is carried out to current wiring regulations by qualified electricians, and we provide the certification you will need for building control or a future sale.',
    },
    {
      q: 'Can you do a full or partial rewire?',
      a: 'We handle everything from adding sockets and lighting circuits to full and partial rewires, consumer-unit upgrades and fault finding, with minimal disruption to your home.',
    },
    {
      q: 'Can you provide an EICR / electrical safety certificate?',
      a: 'We carry out Electrical Installation Condition Reports (EICRs) for homeowners and landlords, and issue the certificate along with clear advice on anything that needs attention.',
    },
  ],
  'carpentry-service': [
    {
      q: 'Do you build bespoke or fitted furniture?',
      a: 'Yes — bespoke wardrobes, alcove units, shelving, media walls and window seats, made to fit your space exactly rather than off-the-shelf sizes.',
    },
    {
      q: 'Can you fit doors, skirting and flooring?',
      a: 'We hang internal and external doors, fit architrave, skirting and cladding, and lay engineered and solid timber flooring, finished to a high standard.',
    },
    {
      q: 'Do you take on smaller repairs?',
      a: 'We do — sticking doors, rotten frames, damaged stairs and squeaky floors and the like. Happy to handle a single repair as well as a full fit-out.',
    },
  ],
  'roofing-service': [
    {
      q: 'Do you work on flat and pitched roofs?',
      a: 'Both — from re-tiling and slate repairs on pitched roofs to felt, EPDM rubber and GRP fibreglass flat roofs, plus full replacements where needed.',
    },
    {
      q: 'Can you fix a leak, or only replace the whole roof?',
      a: 'We start with the smallest fix that solves the problem — tracing and repairing leaks, replacing slipped tiles or flashing — and only recommend a full replacement when the roof genuinely needs it.',
    },
    {
      q: 'Do you handle gutters, fascias and soffits?',
      a: 'Yes — we clear, repair and replace guttering, fascias and soffits, and can sort the leadwork and pointing around chimneys and valleys while we are up there.',
    },
  ],
  'handyman-service': [
    {
      q: 'What jobs does your handyman service cover?',
      a: 'The long list of small jobs around the home — flat-pack assembly, shelves and mirrors, TV mounting, door and lock adjustments, sealant, minor plumbing and electrics, and general repairs.',
    },
    {
      q: 'Can I book by the hour?',
      a: 'Yes — you can book by the hour or half-day, and we are happy to work through several small jobs in one visit so you get the most from the time.',
    },
    {
      q: 'Can you do several odd jobs in one visit?',
      a: 'Absolutely — send us your list when you book and we will come prepared with the right tools and materials to tick off as much as possible in one go.',
    },
  ],
};

const PAGE_KEYS = Object.keys(FAQ_BY_PAGE);

// --- 1. defensive schema check ----------------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let schemaChanged = false;

if (!nextSchema.find((t) => t.__name === 'faq') || !nextSchema.find((t) => t.__name === 'faq-item'))
  throw new Error(
    'seed-faq-service-pages: "faq"/"faq-item" Types missing — run scripts/seed-faq-timing-schema.mjs first'
  );

const pageType = nextSchema.find((t) => t.__name === 'page');
if (!pageType) throw new Error('seed-faq-service-pages: no "page" Type in schema');
const sectionsField = (pageType.fields ?? []).find((f) => f.__name === 'sections');
if (!sectionsField) throw new Error('seed-faq-service-pages: "page" has no "sections" field');
sectionsField.allowedTypes = sectionsField.allowedTypes ?? [];
if (!sectionsField.allowedTypes.includes('faq')) {
  sectionsField.allowedTypes.push('faq');
  schemaChanged = true;
  console.log('schema: added "faq" to page.sections allowedTypes');
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

// --- 2. Case Studies boundary + existing faq ids (idempotency) --------------
const caseStudies = await adapter.query('case-studies-section', { page: { limit: 100 } });
const caseStudyIds = new Set(caseStudies.data.map((c) => c.__id));
const existingFaq = await adapter.query('faq', { page: { limit: 1000 } });
const existingFaqIds = new Set(existingFaq.data.map((e) => e.__id));

// --- 3. per-page create + publish + insert before Case Studies ---------------
for (const key of PAGE_KEYS) {
  const res = await adapter.query('page', { where: { key: { eq: key } }, page: { limit: 1 } });
  const pageEntry = res.data[0];
  if (!pageEntry) {
    console.warn(`  ! "${key}" not found — skipping`);
    continue;
  }

  const sections = Array.isArray(pageEntry.sections) ? [...pageEntry.sections] : [];
  if (sections.some((id) => existingFaqIds.has(id))) {
    console.log(`  = ${key}: already has a FAQ — skipping`);
    continue;
  }

  const itemIds = [];
  for (const { q, a } of FAQ_BY_PAGE[key]) {
    const item = await adapter.create('faq-item', { question: q, answer: [p(a)] }, ACTOR);
    const pub = await adapter.publish('faq-item', item.__id, ACTOR, item.__lastEditedAt);
    itemIds.push(pub.__id);
  }

  const faq = await adapter.create(
    'faq',
    { overline: 'Good to know', title: 'Frequently asked questions', items: itemIds },
    ACTOR
  );
  const faqPub = await adapter.publish('faq', faq.__id, ACTOR, faq.__lastEditedAt);

  let idx = sections.findIndex((id) => caseStudyIds.has(id));
  if (idx === -1) idx = sections.length; // no Case Studies found → append
  const nextSections = [...sections.slice(0, idx), faqPub.__id, ...sections.slice(idx)];

  const patched = await adapter.patch(
    'page',
    pageEntry.__id,
    { sections: nextSections },
    ACTOR,
    pageEntry.__lastEditedAt
  );
  await adapter.publish('page', pageEntry.__id, ACTOR, patched.__lastEditedAt);
  console.log(`  + ${key}: inserted FAQ (3 items) before Case Studies at index ${idx}`);
}

console.log('seed-faq-service-pages: done.');
