/**
 * Schema seed (additive, idempotent): adds the CMS Types + enum options that
 * back two features:
 *
 *   1. Enquiry Wizard renovation-timing step — extends the `form-field`
 *      `inputType` lookup with `date` + `timeWindow` (a hyphen would drop the
 *      whole lookup back to a String scalar — see libs/zero-cms-graphql naming
 *      `lookupCanEnum`, so the value is camelCase, not `time-window`).
 *   2. About-page FAQ section — a `faq` section Type (overline / title + a
 *      One-to-Many `items` relation) whose children are `faq-item` Types
 *      (question + rich answer). `faq` is appended to `page.sections`
 *      allowedTypes so it joins the PageSectionsRef union.
 *
 * All three edits are additive, so they clear `Engine.saveSchema`'s
 * destructive-edit guard (it only blocks changes that invalidate existing
 * PUBLISHED entries). WRITES TO THE SHARED LIVE Redis (ADR 0008) — but schema
 * only; no entries are created here (see seed-faq-timing-content.mjs).
 *
 * Same harness as scripts/seed-split-sections.mjs.
 *
 * Usage: node scripts/seed-faq-timing-schema.mjs
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
  if (!v) throw new Error(`seed-faq-timing-schema: ${name} is required`);
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

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let changed = false;

// --- 1. form-field.inputType: add `date` + `timeWindow` options -------------
const formField = next.find((t) => t.__name === 'form-field');
if (!formField) throw new Error('seed-faq-timing-schema: no "form-field" Type in schema');
const inputTypeField = (formField.fields ?? []).find((f) => f.__name === 'inputType');
if (!inputTypeField) throw new Error('seed-faq-timing-schema: "form-field" has no "inputType" field');
if (inputTypeField.__type !== 'lookup')
  throw new Error(`seed-faq-timing-schema: "inputType" is __type "${inputTypeField.__type}", expected "lookup"`);
inputTypeField.options = inputTypeField.options ?? [];
for (const opt of ['date', 'timeWindow']) {
  if (!inputTypeField.options.includes(opt)) {
    inputTypeField.options.push(opt);
    changed = true;
    console.log(`schema: added inputType option "${opt}"`);
  }
}

// --- 2. faq-item Type (question + rich answer) ------------------------------
if (!next.find((t) => t.__name === 'faq-item')) {
  next.push({
    __name: 'faq-item',
    label: 'FAQ Item',
    fields: [
      { __name: 'question', __type: 'text', label: 'Question' },
      { __name: 'answer', __type: 'blocks', label: 'Answer' },
    ],
  });
  changed = true;
  console.log('schema: added Type "faq-item"');
}

// --- 3. faq section Type (overline / title + One-to-Many items) -------------
if (!next.find((t) => t.__name === 'faq')) {
  next.push({
    __name: 'faq',
    label: 'FAQ',
    fields: [
      { __name: 'overline', __type: 'text', label: 'Overline' },
      { __name: 'title', __type: 'text', label: 'Title' },
      { __name: 'items', __type: 'references', label: 'Questions', allowedTypes: ['faq-item'] },
    ],
  });
  changed = true;
  console.log('schema: added Type "faq"');
}

// --- 4. page.sections allowedTypes += faq -----------------------------------
const pageType = next.find((t) => t.__name === 'page');
if (!pageType) throw new Error('seed-faq-timing-schema: no "page" Type in schema');
const sectionsField = (pageType.fields ?? []).find((f) => f.__name === 'sections');
if (!sectionsField) throw new Error('seed-faq-timing-schema: "page" has no "sections" field');
sectionsField.allowedTypes = sectionsField.allowedTypes ?? [];
if (!sectionsField.allowedTypes.includes('faq')) {
  sectionsField.allowedTypes.push('faq');
  changed = true;
  console.log('schema: added "faq" to page.sections allowedTypes');
}

// --- save -------------------------------------------------------------------
if (changed) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

console.log('seed-faq-timing-schema: done.');
