/**
 * Seed the legal pages: Privacy Policy + Terms & Conditions.
 *
 * 1. Adds the `prose-section` Type (overline + blocks `body`) to the live Redis
 *    schema and appends it to the `page` type's `sections` allowedTypes (both
 *    idempotent — additive, so they pass `saveSchema`'s destructive-edit guard).
 * 2. Creates + publishes, for each page, a MetaData + a PageHero + a
 *    ProseSection, then the `page` entry that references them (key
 *    `privacy-policy` / `terms-and-conditions`).
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008: one Upstash Redis + Vercel Blob
 * behind local/staging/prod). Entries are published immediately. Idempotent:
 * the schema edit is skipped when already present, and a `page` key that
 * already exists is NOT duplicated — instead its ProseSection body/overline is
 * reconciled to the drafted copy below (repairing drift, e.g. malformed blocks
 * from an earlier run), leaving its hero + meta untouched. Re-running is safe.
 *
 * NOTE FOR THE SITE OWNER: the drafted copy is sensible UK boilerplate grounded
 * in how this site actually works (enquiry emails, consent cookies, Trustpilot /
 * Google review widgets), but it is NOT legal advice. Have a solicitor review it
 * before you rely on it. All copy is editable in the CMS afterwards.
 *
 * Same harness as scripts/seed-split-sections.mjs (jiti + @next/env) using the
 * read-write Engine adapter (createRedisAdapter).
 *
 * Usage:
 *   node scripts/seed-legal-pages.mjs --schema-only   # just add the Type
 *   node scripts/seed-legal-pages.mjs                 # schema + pages
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const schemaOnly = process.argv.includes('--schema-only');
// --dry-run: read + report intended changes, write nothing (safe against the
// shared live store). --only <key>: limit page work to a single page key.
const dryRun = process.argv.includes('--dry-run');
const onlyKey = (() => {
  const i = process.argv.indexOf('--only');
  return i !== -1 ? process.argv[i + 1] : null;
})();

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`seed-legal-pages: ${name} is required`);
  return v;
}

const jiti = createJiti(import.meta.url, {
  alias: {
    '@usc/zero-cms-core/node': lib('libs/zero-cms-core/src/node.ts'),
    '@usc/zero-cms-core': lib('libs/zero-cms-core/src/index.ts'),
  },
});

const { createRedisAdapter } = await jiti.import('@usc/zero-cms-core/node');
const { pascalCase } = await jiti.import('@usc/zero-cms-core');

const adapter = await createRedisAdapter(
  { url: requireEnv('STORAGE_KV_REST_API_URL'), token: requireEnv('STORAGE_KV_REST_API_TOKEN') },
  { token: requireEnv('BLOB_READ_WRITE_TOKEN') }
);

const ACTOR = 'seed:legal-pages';
const PROSE_TYPE = 'prose-section';

// --- 1. schema (idempotent) -------------------------------------------------
const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let schemaChanged = false;

// `body` is `blocks` (JSON) — the same rich body kind who-we-are / split-section
// use and what <RichTextViewer> renders. (`richtext` maps to a String scalar,
// which would mis-render and collide with the other sections' JSON `body` inside
// the GetPage union — see scripts/seed-split-sections.mjs.)
const PROSE_FIELDS = [
  { __name: 'overline', __type: 'text' },
  { __name: 'body', __type: 'blocks' },
];

const existingIdx = nextSchema.findIndex((t) => t.__name === PROSE_TYPE);
if (existingIdx === -1) {
  nextSchema.push({ __name: PROSE_TYPE, label: 'Prose Section', fields: PROSE_FIELDS });
  schemaChanged = true;
  console.log(`schema: added Type "${PROSE_TYPE}"`);
} else if (
  JSON.stringify(nextSchema[existingIdx].fields) !== JSON.stringify(PROSE_FIELDS)
) {
  nextSchema[existingIdx] = {
    ...nextSchema[existingIdx],
    label: 'Prose Section',
    fields: PROSE_FIELDS,
  };
  schemaChanged = true;
  console.log(`schema: reconciled Type "${PROSE_TYPE}" fields`);
}

const pageType = nextSchema.find((t) => t.__name === 'page');
if (!pageType) throw new Error('seed-legal-pages: no "page" Type in schema');
const sectionsField = pageType.fields.find((f) => f.__name === 'sections');
if (!sectionsField) throw new Error('seed-legal-pages: "page" has no "sections" field');
sectionsField.allowedTypes = sectionsField.allowedTypes ?? [];
if (!sectionsField.allowedTypes.includes(PROSE_TYPE)) {
  sectionsField.allowedTypes.push(PROSE_TYPE);
  schemaChanged = true;
  console.log('schema: added "prose-section" to page.sections allowedTypes');
}

if (schemaChanged) {
  if (dryRun) {
    console.log('schema: WOULD save (dry-run, no write).');
  } else {
    await adapter.saveSchema(nextSchema, ACTOR, version);
    console.log('schema: saved.');
  }
} else {
  console.log('schema: already up to date.');
}

if (schemaOnly) {
  console.log('seed-legal-pages: --schema-only, done.');
  process.exit(0);
}

// --- 2. resolve dependent type slugs from the live schema -------------------
// GraphQL type name = pascalCase(cms __name) (libs/zero-cms-graphql naming.ts),
// so resolve back the other way to stay correct if a slug ever differs.
const liveSchema = schemaChanged ? nextSchema : schema;
const slugFor = (gqlName) => {
  const t = liveSchema.find((x) => pascalCase(x.__name) === gqlName);
  if (!t) throw new Error(`seed-legal-pages: no CMS type maps to GraphQL "${gqlName}"`);
  return t.__name;
};
const META_TYPE = slugFor('MetaData'); // "meta-data"
const HERO_TYPE = slugFor('PageHero'); // "page-hero"
const PAGE_TYPE = 'page';

// --- 3. block helpers (Strapi-blocks shape that <ZeroCmsBlocks> renders) -----
const text = (t) => ({ type: 'text', text: t });
const bold = (t) => ({ type: 'text', text: t, bold: true });
const link = (t, url) => ({ type: 'link', url, children: [text(t)] });
const p = (...children) => ({
  type: 'paragraph',
  children: children.length ? children : [text('')],
});
const ptext = (t) => p(text(t));
const h = (level, t) => ({ type: 'heading', level, children: [text(t)] });
const li = (...children) => ({
  type: 'list-item',
  children: children.length ? children : [text('')],
});
const ul = (items) => ({
  type: 'list',
  format: 'unordered',
  children: items.map((i) => (typeof i === 'string' ? li(text(i)) : i)),
});

const LAST_UPDATED = 'Last updated: 12 July 2026.';

// --- 4. drafted copy --------------------------------------------------------
const privacyBody = [
  p(bold(LAST_UPDATED)),
  ptext(
    'This policy explains how Upper Street Contractors ("we", "us", "our") ' +
      'collects and uses your personal information when you visit this website or ' +
      'get in touch about building and renovation work. We are a building ' +
      'contractor based in Islington, working across North London.'
  ),

  h(2, 'Information we collect'),
  ptext('When you send an enquiry through our website, we collect the details you give us, which may include:'),
  ul([
    'your name, email address and phone number;',
    'details about your project and property;',
    'any files or photos you choose to attach to your enquiry.',
  ]),
  ptext(
    'We also record your cookie choices, and our web host may log standard ' +
      'technical information such as your IP address to keep the site secure and running.'
  ),

  h(2, 'How we use your information'),
  ul([
    'to respond to your enquiry and prepare a quote;',
    'to arrange and carry out any work you ask us to do;',
    'to keep records of our dealings with you;',
    'to keep the website secure and working properly.',
  ]),

  h(2, 'Our legal bases'),
  ptext('Under UK data protection law we rely on:'),
  ul([
    'your consent — for non-essential cookies and third-party review widgets;',
    'taking steps at your request before entering into a contract — when you ask us for a quote;',
    'our legitimate interests — to respond to enquiries and run our business securely.',
  ]),

  h(2, 'Cookies and similar technologies'),
  ptext(
    'We use a small number of strictly necessary cookies that keep the site ' +
      'working and remember your cookie choices — these do not need consent. ' +
      'With your consent, we also load third-party review widgets (see below). ' +
      'You can change or withdraw your consent at any time using the "Cookie ' +
      'preferences" link in the footer.'
  ),

  h(2, 'Sharing your information'),
  ptext('We do not sell your personal information. We share it only where necessary with:'),
  ul([
    'our email provider, to deliver enquiry emails to us and a confirmation to you;',
    'Trustpilot and Google, if you consent to their review widgets loading on the site;',
    'professional advisers or authorities where we are required to by law.',
  ]),

  h(2, 'How long we keep it'),
  ptext(
    'We keep enquiry and project information only for as long as we need it to ' +
      'deal with your enquiry, carry out the work and meet our legal and ' +
      'accounting obligations, after which it is securely deleted.'
  ),

  h(2, 'Your rights'),
  ptext(
    'You have the right to access, correct or delete your personal information, ' +
      'to object to or restrict how we use it, and to ask for a copy of it.'
  ),
  p(
    text('To exercise any of these rights, please contact us using the details on our '),
    link('Contact page', '/contact'),
    text('. If you are unhappy with how we have handled your information, you can complain to the Information Commissioner’s Office at '),
    link('ico.org.uk', 'https://ico.org.uk'),
    text('.')
  ),

  h(2, 'Changes to this policy'),
  ptext(
    'We may update this policy from time to time. Any changes will be posted on ' +
      'this page with a revised "last updated" date.'
  ),

  h(2, 'Contact us'),
  p(
    text('For any questions about this policy or your personal information, please get in touch via our '),
    link('Contact page', '/contact'),
    text('.')
  ),
];

const termsBody = [
  p(bold(LAST_UPDATED)),
  ptext(
    'These terms govern your use of the Upper Street Contractors website and, ' +
      'together with any written quotation we give you, the building and ' +
      'renovation services we provide. Please read them carefully. We are a ' +
      'building contractor based in Islington, working across North London.'
  ),

  h(2, '1. Using this website'),
  ptext(
    'You may use this website for lawful purposes only. The content is provided ' +
      'for general information about our services and does not form a binding ' +
      'offer. We may change or withdraw any part of the site at any time.'
  ),

  h(2, '2. Quotations and estimates'),
  ptext(
    'Any prices shown on this website or given verbally are indicative only. A ' +
      'quotation becomes binding only once we have surveyed the work and issued a ' +
      'written quote that you have accepted. Quotes are valid for 30 days unless ' +
      'we state otherwise.'
  ),

  h(2, '3. Prices and payment'),
  ptext(
    'Prices are in pounds sterling. Unless agreed otherwise in writing, payment ' +
      'terms and any deposit or stage payments will be set out in your accepted ' +
      'quote. Invoices are due within the period stated on the invoice.'
  ),

  h(2, '4. Variations to the work'),
  ptext(
    'If you ask us to change the agreed scope, or if unforeseen work is needed ' +
      '(for example, hidden defects revealed once work begins), we will agree any ' +
      'additional cost and time with you before continuing wherever practicable.'
  ),

  h(2, '5. Workmanship and guarantee'),
  ptext(
    'We carry out our work with reasonable care and skill and in line with ' +
      'relevant standards. Manufacturer guarantees apply to the materials and ' +
      'appliances we install. Any workmanship guarantee we offer will be confirmed ' +
      'in writing and does not cover fair wear and tear, misuse, or work later ' +
      'altered by others.'
  ),

  h(2, '6. Your responsibilities'),
  ptext('To let us carry out the work safely and on time, you are responsible for:'),
  ul([
    'giving us safe and timely access to the property;',
    'making sure the information you give us is accurate;',
    'obtaining any permissions or approvals that are your responsibility.',
  ]),

  h(2, '7. Cancellations'),
  ptext(
    'Where you are a consumer, you may have a statutory right to cancel within a ' +
      'cooling-off period. If you ask us to begin work during that period, we may ' +
      'charge for work already done. Any specific cancellation terms will be set ' +
      'out in your quote.'
  ),

  h(2, '8. Liability'),
  ptext(
    'Nothing in these terms limits our liability for death or personal injury ' +
      'caused by our negligence, for fraud, or for anything that cannot be limited ' +
      'by law. Subject to that, our liability is limited to the price of the work ' +
      'in question, and we are not responsible for indirect or unforeseeable losses.'
  ),

  h(2, '9. Governing law'),
  ptext(
    'These terms are governed by the law of England and Wales, and the courts of ' +
      'England and Wales have exclusive jurisdiction.'
  ),

  h(2, '10. Contact us'),
  p(
    text('If you have any questions about these terms, please get in touch via our '),
    link('Contact page', '/contact'),
    text('.')
  ),
];

const PAGES = [
  {
    key: 'privacy-policy',
    title: 'Privacy Policy',
    description:
      'How Upper Street Contractors collects, uses and protects your personal information.',
    meta: {
      title: 'Privacy Policy',
      description:
        'How Upper Street Contractors collects, uses and protects your personal data when you use our website or request a quote.',
    },
    hero: {
      breadcrumbLabel: 'Privacy Policy',
      overline: 'Legal',
      title: 'Privacy Policy',
      subtitle: 'How we collect, use and protect your personal information.',
    },
    prose: { overline: 'Data & privacy', body: privacyBody },
  },
  {
    key: 'terms-and-conditions',
    title: 'Terms & Conditions',
    description:
      'The terms governing use of our website and our building and renovation services.',
    meta: {
      title: 'Terms & Conditions',
      description:
        'The terms governing use of the Upper Street Contractors website and our building and renovation services.',
    },
    hero: {
      breadcrumbLabel: 'Terms & Conditions',
      overline: 'Legal',
      title: 'Terms & Conditions',
      subtitle: 'The terms behind our website and our work.',
    },
    prose: { overline: 'Terms of service', body: termsBody },
  },
];

// --- 5. create + publish ----------------------------------------------------
async function createPublished(type, values) {
  const created = await adapter.create(type, values, ACTOR);
  await adapter.publish(type, created.__id, ACTOR, created.__lastEditedAt);
  return created.__id;
}

const refId = (s) => (typeof s === 'string' ? s : (s?.__id ?? s?.id));

/**
 * Reconcile the ProseSection body/overline for a page that ALREADY exists.
 *
 * Why this is needed: the create path stores blocks verbatim, so an earlier
 * run that seeded malformed blocks (e.g. empty list-item text — invisible
 * bullets) leaves bad content that a create-only re-run would skip forever.
 * Reconciling makes the drafted copy above the single source of truth and lets
 * a plain re-run repair drift. Only the ProseSection is touched (hero + meta
 * are left as-is so CMS edits to them survive).
 */
async function reconcileProse(pageEntry, page) {
  const sectionIds = (pageEntry.sections ?? []).map(refId).filter(Boolean);
  const prose = (await adapter.query(PROSE_TYPE, { page: { limit: 200 } })).data.find(
    (e) => sectionIds.includes(e.__id)
  );
  if (!prose) {
    console.log(`  ! ${page.key}: no ProseSection in page.sections — cannot repair`);
    return;
  }

  const desired = { overline: page.prose.overline, body: page.prose.body };
  const same =
    JSON.stringify({ overline: prose.overline, body: prose.body }) ===
    JSON.stringify(desired);
  if (same) {
    console.log(`  = ${page.key}: ProseSection already up to date`);
    return;
  }

  // Report which list-items are currently empty (the invisible-bullets bug) so
  // a dry-run makes the repair auditable before any write to the shared store.
  const emptyItems = (prose.body ?? [])
    .filter((n) => n?.type === 'list')
    .flatMap((l) => l.children ?? [])
    .filter((it) => (it.children ?? []).every((c) => !c.text)).length;

  if (dryRun) {
    console.log(
      `  ~ ${page.key}: WOULD reconcile ProseSection (dry-run) — ` +
        `${page.prose.body.length} blocks, repairing ${emptyItems} empty list-item(s)`
    );
    return;
  }

  const updated = await adapter.update(PROSE_TYPE, prose.__id, desired, ACTOR, prose.__lastEditedAt);
  await adapter.publish(PROSE_TYPE, prose.__id, ACTOR, updated.__lastEditedAt);
  console.log(
    `  ~ ${page.key}: ProseSection reconciled (${page.prose.body.length} blocks, ` +
      `repaired ${emptyItems} empty list-item(s)) + published`
  );
}

for (const page of PAGES) {
  if (onlyKey && page.key !== onlyKey) continue;

  const existing = await adapter.query(PAGE_TYPE, {
    where: { key: { eq: page.key } },
    page: { limit: 1 },
  });
  if (existing.data[0]) {
    await reconcileProse(existing.data[0], page);
    continue;
  }

  if (dryRun) {
    console.log(`  + ${page.key}: WOULD create page + sections (dry-run, no write)`);
    continue;
  }

  const metaId = await createPublished(META_TYPE, page.meta);
  const heroId = await createPublished(HERO_TYPE, page.hero);
  const proseId = await createPublished(PROSE_TYPE, page.prose);
  await createPublished(PAGE_TYPE, {
    key: page.key,
    title: page.title,
    description: page.description,
    meta: metaId,
    sections: [heroId, proseId],
  });

  console.log(`  + ${page.key}: created PageHero + ProseSection + MetaData + page`);
}

console.log('seed-legal-pages: done.');
