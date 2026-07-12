/**
 * Content seed for the FAQ + renovation-timing features. Creates entries as
 * DRAFTS ONLY (create → draft; no publish call), then patches the parent
 * relations as drafts too. Nothing is published, so live/production visitors
 * see no change until an Editor hits "Publish all changes" in Inspect mode;
 * meanwhile the additions render locally under preview/draft reads.
 *
 * Idempotent: re-running skips the timing step if a `renovationDate` field
 * already exists, and skips the FAQ if any `faq` entry already exists.
 *
 * Two features:
 *   1. Timing step — 3 form-field drafts (emergency boolean / renovationDate
 *      date / timeWindow) → 1 form-question draft → spliced into the Contact
 *      `wizard`'s questions (as the second-to-last step).
 *   2. FAQ — 5 faq-item drafts → 1 faq draft → appended to the `about-us`
 *      page's sections (rendered last by apps/website .../about/page.tsx).
 *
 * Prereq: run scripts/seed-faq-timing-schema.mjs first (the Types must exist).
 * WRITES TO THE SHARED LIVE Redis (ADR 0008) — drafts only. Same harness as
 * scripts/seed-split-sections.mjs.
 *
 * Usage: node scripts/seed-faq-timing-content.mjs
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
  if (!v) throw new Error(`seed-faq-timing-content: ${name} is required`);
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

const ACTOR = 'seed:faq-timing';

// Strapi-blocks paragraph (what RichTextViewer / ZeroCmsBlocks render).
const p = (text) => ({ type: 'paragraph', children: [{ type: 'text', text }] });

// =====================================================================
// 1. Renovation-timing step
// =====================================================================
const existingDate = await adapter.query('form-field', {
  where: { fieldKey: { eq: 'renovationDate' } },
  page: { limit: 1 },
});

if (existingDate.data.length > 0) {
  console.log('timing: renovationDate field already exists — skipping timing step');
} else {
  const wizards = await adapter.query('wizard', { page: { limit: 10 } });
  if (wizards.data.length === 0) throw new Error('seed-faq-timing-content: no "wizard" entry found');
  if (wizards.data.length > 1)
    console.warn(`timing: ${wizards.data.length} wizards found — using the first`);
  const wizard = wizards.data[0];

  const FIELDS = [
    { label: 'Is this an emergency?', fieldKey: 'emergency', inputType: 'boolean', required: false },
    { label: 'Preferred start date', fieldKey: 'renovationDate', inputType: 'date', required: false },
    { label: 'Preferred time of day', fieldKey: 'timeWindow', inputType: 'timeWindow', required: false },
  ];

  const fieldIds = [];
  for (const f of FIELDS) {
    const created = await adapter.create('form-field', f, ACTOR);
    fieldIds.push(created.__id);
    console.log(`timing: created form-field "${f.fieldKey}" (${created.__id})`);
  }

  const question = await adapter.create(
    'form-question',
    {
      stepLabel: 'Timing',
      title: 'When do you plan this renovation?',
      hint: 'Tell us your ideal timing — an approximate date and time of day is fine.',
      fields: fieldIds,
    },
    ACTOR
  );
  console.log(`timing: created form-question (${question.__id})`);

  // Splice in as the second-to-last step (keep the final details/submit step last).
  const questions = Array.isArray(wizard.questions) ? [...wizard.questions] : [];
  const insertAt = Math.max(0, questions.length - 1);
  questions.splice(insertAt, 0, question.__id);

  await adapter.patch('wizard', wizard.__id, { questions }, ACTOR, wizard.__lastEditedAt);
  console.log(
    `timing: patched wizard ${wizard.__id} — inserted step at index ${insertAt} of ${questions.length} (DRAFT)`
  );
}

// =====================================================================
// 2. About-page FAQ
// =====================================================================
const existingFaq = await adapter.query('faq', { page: { limit: 1 } });

if (existingFaq.data.length > 0) {
  console.log('faq: a faq entry already exists — skipping FAQ seed');
} else {
  const QA = [
    {
      q: 'Which areas do you cover?',
      a: [p("We're based in Islington and work across North London — Camden, Hackney, Haringey and the surrounding boroughs. If you're just outside, ask us and we'll let you know.")],
    },
    {
      q: 'Do you provide free quotes?',
      a: [p('Yes. We visit your property, talk through your plans and provide a clear, fixed written quote at no cost and no obligation — no vague estimates that creep once work begins.')],
    },
    {
      q: 'Are you insured and accredited?',
      a: [p('Every project is fully insured, and our trades hold the relevant Gas Safe, NICEIC and industry accreditations. We can share certificates on request.')],
    },
    {
      q: 'How long will my renovation take?',
      a: [p('It depends on scope — a bathroom is typically one to two weeks, a full refurbishment six to twelve. We agree a realistic timeline up front and keep you updated at every stage.')],
    },
    {
      q: 'Do you handle building control and planning?',
      a: [p('Where a project needs building control sign-off or planning permission, we manage the process and liaise with the relevant authorities on your behalf.')],
    },
  ];

  const itemIds = [];
  for (const { q, a } of QA) {
    const item = await adapter.create('faq-item', { question: q, answer: a }, ACTOR);
    itemIds.push(item.__id);
    console.log(`faq: created faq-item "${q}" (${item.__id})`);
  }

  const faq = await adapter.create(
    'faq',
    {
      overline: 'Good to know',
      title: 'Frequently asked questions',
      items: itemIds,
    },
    ACTOR
  );
  console.log(`faq: created faq section (${faq.__id})`);

  const pages = await adapter.query('page', {
    where: { key: { eq: 'about-us' } },
    page: { limit: 1 },
  });
  const about = pages.data[0];
  if (!about) throw new Error('seed-faq-timing-content: no "about-us" page found');

  const sections = Array.isArray(about.sections) ? [...about.sections] : [];
  sections.push(faq.__id);
  await adapter.patch('page', about.__id, { sections }, ACTOR, about.__lastEditedAt);
  console.log(`faq: patched about-us page ${about.__id} — appended faq section (DRAFT)`);
}

console.log('seed-faq-timing-content: done.');
