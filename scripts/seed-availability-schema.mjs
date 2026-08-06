/**
 * Schema seed (additive, idempotent): backs the Enquiry Wizard's Availability
 * field — a multi-date calendar with one row of Time windows per Preferred date.
 *
 *   1. `form-field.inputType` += `availability`. camelCase, not `availability-*`
 *      or anything hyphenated: one invalid option drops the whole lookup back to
 *      a String scalar (libs/zero-cms-graphql `lookupCanEnum`).
 *   2. Four config attributes on `form-field` so an editor can tune the calendar
 *      from the Edit drawer without a deploy. `form-field` is a single Type, so
 *      these show on every field's drawer — the same cost `dependsOnFieldKey` /
 *      `dependsOnValue` already pay. The `Availability:` label prefix is what
 *      keeps that legible.
 *
 * Defaults mirror AVAILABILITY_DEFAULTS in
 * apps/website/src/components/sections/wizard/helpers.ts — keep the two in step.
 * `min`/`max` are set here rather than in /admin because the Type builder only
 * exposes the `integer` checkbox for number fields, not the bounds.
 *
 * Both edits are additive, so they clear `Engine.saveSchema`'s destructive-edit
 * guard (it validates existing PUBLISHED values with `forPublish: false`, which
 * skips absent fields). Per ADR 0011 read-time projection injects `default` into
 * entries stored before the field existed — no backfill needed. WRITES TO THE
 * SHARED LIVE Redis (ADR 0008) — schema only; no entries are touched here.
 *
 * Same harness as scripts/seed-faq-timing-schema.mjs.
 *
 * Usage: node scripts/seed-availability-schema.mjs
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
  if (!v) throw new Error(`seed-availability-schema: ${name} is required`);
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

const ACTOR = 'seed:availability';

/**
 * The Availability calendar's editor controls. 0 means "no limit" on all three
 * numbers — and that has to live in the `label`, because the Content admin
 * renders a field's label but not its `description` (verified in the drawer).
 * The descriptions stay for the day it does.
 */
const CONFIG_FIELDS = [
  {
    __name: 'maxDates',
    __type: 'number',
    label: 'Availability: max dates (0 = unlimited)',
    description: 'How many days a visitor may pick.',
    integer: true,
    min: 0,
    max: 60,
    default: 5,
  },
  {
    __name: 'earliestOffsetDays',
    __type: 'number',
    label: 'Availability: earliest date (days from today, 0 = today)',
    description: 'How soon a visitor may pick. 1 = tomorrow.',
    integer: true,
    min: 0,
    max: 365,
    default: 0,
  },
  {
    __name: 'horizonMonths',
    __type: 'number',
    label: 'Availability: horizon in months (0 = no limit)',
    description: 'How far ahead a visitor may pick.',
    integer: true,
    min: 0,
    max: 36,
    default: 6,
  },
  {
    __name: 'allowWeekends',
    __type: 'boolean',
    label: 'Availability: allow weekends (off hides Sat + Sun)',
    description: 'Whether Saturday and Sunday are selectable.',
    default: true,
  },
];

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let changed = false;

const formField = next.find((t) => t.__name === 'form-field');
if (!formField) throw new Error('seed-availability-schema: no "form-field" Type in schema');
formField.fields = formField.fields ?? [];

// --- 1. form-field.inputType: add the `availability` option ------------------
const inputTypeField = formField.fields.find((f) => f.__name === 'inputType');
if (!inputTypeField)
  throw new Error('seed-availability-schema: "form-field" has no "inputType" field');
if (inputTypeField.__type !== 'lookup')
  throw new Error(
    `seed-availability-schema: "inputType" is __type "${inputTypeField.__type}", expected "lookup"`
  );
inputTypeField.options = inputTypeField.options ?? [];
if (!inputTypeField.options.includes('availability')) {
  inputTypeField.options.push('availability');
  changed = true;
  console.log('schema: added inputType option "availability"');
} else {
  console.log('schema: inputType option "availability" already present — left alone');
}

// --- 2. form-field: the four Availability config attributes -----------------
for (const spec of CONFIG_FIELDS) {
  const existing = formField.fields.find((f) => f.__name === spec.__name);
  if (existing) {
    if (existing.__type !== spec.__type)
      throw new Error(
        `seed-availability-schema: "form-field.${spec.__name}" is __type "${existing.__type}", expected "${spec.__type}"`
      );
    // Reconcile the presentation bits rather than skipping outright, so a label
    // reword lands on a re-run. Data-shape keys (__type, default) are left as
    // they are — changing those on a live field is not this script's business.
    let touched = false;
    for (const key of ['label', 'description', 'min', 'max', 'integer']) {
      if (key in spec && existing[key] !== spec[key]) {
        existing[key] = spec[key];
        touched = true;
      }
    }
    if (touched) {
      changed = true;
      console.log(`schema: refreshed label/bounds on "form-field.${spec.__name}"`);
    } else {
      console.log(`schema: "form-field.${spec.__name}" already up to date — left alone`);
    }
    continue;
  }
  formField.fields.push({ ...spec });
  changed = true;
  console.log(`schema: added "form-field.${spec.__name}" (default ${spec.default})`);
}

// --- save -------------------------------------------------------------------
if (changed) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

console.log('seed-availability-schema: done.');
