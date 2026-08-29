/**
 * Schema seed (additive, idempotent): gives the Enquiry Wizard a way to say
 * "show this because of an answer on an earlier step".
 *
 * Before this, the only conditional the CMS could express was
 * `dependsOnFieldKey`/`dependsOnValue` on a `form-field` — scoped to sibling
 * fields inside ONE Form Question, and evaluated against text answers only. An
 * Image Question answer (the job type picked on step 1) could not drive
 * anything at all, so every visitor saw the same room cards, the same service
 * cards, the same emergency toggle and the same heading — including the hourly
 * visitor being asked "When do you plan this renovation?".
 *
 * ## The Branch rule
 *
 * One primitive, three carriers. Each gains the same pair of fields:
 *
 *   `appliesTo`     references → image-option. Which step-1 job types this
 *                   belongs to. EMPTY MEANS ALWAYS SHOWN, so every entry that
 *                   exists today keeps behaving exactly as it does now and the
 *                   rollout is not a content migration.
 *   `whenEmergency` any | only | never. Whether the emergency flag has to be
 *                   on, off, or is irrelevant.
 *
 * carried by `image-option` (a card), `form-field` (a question field) and the
 * new `step-copy` Type (a wording variant for a whole step).
 *
 * ## The other additions
 *
 *   image-question.body / form-question.body — `blocks`, so a step can carry a
 *     real paragraph under its title instead of the one-line plain `hint`.
 *     `blocks` and not `richtext`: every other rich body on this site is blocks
 *     and mixing the two kinds breaks codegen.
 *   image-question.gatedBy — names the earlier Image Question whose answers
 *     gate this step's cards. Its only job is to let the editor UI warn when a
 *     card on a gated step has no `appliesTo` set; the runtime still falls back
 *     to showing it, because a half-configured step must not silently lose
 *     options for a visitor.
 *   *.variants — the step-copy entries a question may pick its wording from.
 *   form-field.isEmergencyFlag — marks WHICH boolean field is the emergency
 *     switch. An explicit marker rather than matching on `fieldKey === 'emergency'`,
 *     so renaming the key in the CMS cannot quietly break every branch rule.
 *   form-field.emergencyHorizonDays — how far ahead the Availability calendar
 *     may reach while the emergency flag is on. 0 = use the normal horizon.
 *
 * All additive, so `saveSchema`'s destructive-edit guard passes (it validates
 * existing published values and skips absent fields), and ADR 0011 read-time
 * projection fills the new fields in for existing entries with no backfill.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008) — schema only, no entries touched.
 * Run `nx codegen website --skip-nx-cache` afterwards.
 *
 * Usage: node scripts/seed-wizard-branch-schema.mjs
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
  if (!v) throw new Error(`seed-wizard-branch-schema: ${name} is required`);
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

const ACTOR = 'seed:wizard-branch';

/** The Branch rule pair, attached to anything that can be shown conditionally. */
const BRANCH_FIELDS = [
  {
    __name: 'appliesTo',
    __type: 'references',
    label: 'Show for these job types',
    description:
      'Pick one or more options from the first step. Leave empty to always show this.',
    allowedTypes: ['image-option'],
  },
  {
    __name: 'whenEmergency',
    __type: 'lookup',
    label: 'Emergency',
    description:
      'any = show either way · only = show only when the emergency switch is on · never = hide when it is on.',
    options: ['any', 'only', 'never'],
    default: 'any',
  },
];

const STEP_BODY = {
  __name: 'body',
  __type: 'blocks',
  label: 'Step introduction',
  description: 'Rich text shown under the step title.',
};

const VARIANTS = {
  __name: 'variants',
  __type: 'references',
  label: 'Wording variants',
  description:
    'Alternative titles and introductions. The first one whose rules match the visitor wins; otherwise the step keeps its own title and introduction.',
  allowedTypes: ['step-copy'],
};

/** Which existing Type gets which new fields. */
const ADDITIONS = {
  'image-option': BRANCH_FIELDS,
  'form-field': [
    ...BRANCH_FIELDS,
    {
      __name: 'isEmergencyFlag',
      __type: 'boolean',
      label: 'This is the emergency switch',
      description:
        'Marks the boolean field whose value the Emergency rules above are read from. Set this on exactly one field.',
      default: false,
    },
    {
      __name: 'emergencyHorizonDays',
      __type: 'number',
      label: 'Emergency booking window (days)',
      description:
        'Availability fields only. How far ahead the calendar may reach while the emergency switch is on. 0 = no special limit.',
      integer: true,
      min: 0,
      max: 365,
      default: 0,
    },
  ],
  'image-question': [
    STEP_BODY,
    VARIANTS,
    {
      __name: 'gatedBy',
      __type: 'reference',
      label: 'Cards chosen by',
      description:
        'The earlier step whose answers decide which cards appear here. Setting this makes the editor warn about any card with no job types picked.',
      allowedTypes: ['image-question'],
    },
  ],
  'form-question': [STEP_BODY, VARIANTS],
};

/** The new Type. Its own fields mirror a question's copy, plus the Branch rule. */
const STEP_COPY_TYPE = {
  __name: 'step-copy',
  label: 'Step wording',
  description: 'Alternative title and introduction for one wizard step.',
  thumbnail: 'richText',
  fields: [
    { __name: 'title', __type: 'text', label: 'Title', required: true },
    { __name: 'body', __type: 'blocks', label: 'Introduction' },
    ...BRANCH_FIELDS,
  ],
};

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));
let changed = false;

// --- 1. the step-copy Type, first: the `variants` fields point at it ---------

if (next.some((t) => t.__name === STEP_COPY_TYPE.__name)) {
  console.log(`schema: Type "${STEP_COPY_TYPE.__name}" already present — left alone`);
} else {
  next.push(JSON.parse(JSON.stringify(STEP_COPY_TYPE)));
  changed = true;
  console.log(`schema: added Type "${STEP_COPY_TYPE.__name}"`);
}

// --- 2. the additive fields --------------------------------------------------

for (const [typeName, fields] of Object.entries(ADDITIONS)) {
  const type = next.find((t) => t.__name === typeName);
  if (!type) throw new Error(`seed-wizard-branch-schema: no "${typeName}" Type in schema`);
  type.fields = type.fields ?? [];

  for (const field of fields) {
    const existing = type.fields.find((f) => f.__name === field.__name);
    if (existing) {
      if (existing.__type !== field.__type)
        throw new Error(
          `seed-wizard-branch-schema: "${typeName}.${field.__name}" is __type "${existing.__type}", expected "${field.__type}"`
        );
      console.log(`schema: "${typeName}.${field.__name}" already present — left alone`);
      continue;
    }
    type.fields.push(JSON.parse(JSON.stringify(field)));
    changed = true;
    console.log(`schema: added "${typeName}.${field.__name}" (${field.__type})`);
  }
}

if (changed) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

console.log('seed-wizard-branch-schema: done.');
