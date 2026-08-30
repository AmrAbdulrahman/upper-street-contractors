/**
 * Content seed (idempotent): turns the Branch-rule machinery on, and moves the
 * Contact Details panel out of the wizard's right-hand column.
 *
 * Five changes, all of which an editor can then adjust in the drawer:
 *
 *   1. **The wizard goes full width.** `wizard.contactDetails` is cleared and
 *      the same `contact-details` entry is appended to the /contact page's own
 *      `sections`, so it renders as a full-width band underneath the form
 *      instead of a 1fr column squeezing it. The entry is reused, not copied —
 *      the phone number stays in one place.
 *   2. **The emergency switch is marked** (`isEmergencyFlag`) so Branch rules
 *      read it by identity rather than by guessing at its `fieldKey`, and the
 *      **Timing step** is given a 7-day emergency booking window: someone
 *      reporting a leak should not be offered a date in six months. The window
 *      belongs to the step, not to either field beneath it — while it lived on
 *      `form-field` this script wrote the same 7 onto both the toggle and the
 *      calendar, and only the calendar's copy was ever read
 *      (scripts/seed-timing-config-to-step.mjs).
 *   3. **The emergency switch is gated to the hourly route.** A planned
 *      renovation is not an emergency, so the toggle only appears for the
 *      "Handyman / Hourly Job" job type. This is the one Branch rule seeded
 *      with real content, because it is the one whose answer is not a judgement
 *      call.
 *   4. **Rooms and Services are marked as gated steps** (`gatedBy` → step 1).
 *      Their cards are deliberately left with an EMPTY `appliesTo`, which still
 *      means "show for everyone" at runtime — nothing disappears for a visitor
 *      because of this script. What it does is make every card wear a
 *      "⚠ no job type set" badge in edit mode, so the mapping is authored by
 *      the person who knows the trade rather than invented here.
 *   5. **The Timing step gets three wording variants**, which is the fix for
 *      an hourly visitor being asked "When do you plan this renovation?".
 *      Emergency wins over the two job-type variants because it is listed
 *      first and the first match is the one used.
 *
 * Reads with `status: 'draft', includeUnpublished: true` (ADR 0006) and
 * publishes what it changes. WRITES TO THE SHARED LIVE Redis (ADR 0008).
 * Prereq: scripts/seed-wizard-branch-schema.mjs.
 *
 * Usage: node scripts/seed-wizard-branch-content.mjs
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
  if (!v) throw new Error(`seed-wizard-branch-content: ${name} is required`);
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

const ACTOR = 'seed:wizard-branch-content';
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 500 } };

/** A one-paragraph blocks body. Matches what the BlocksEditor round-trips. */
const para = (text) => [{ type: 'paragraph', children: [{ type: 'text', text }] }];

async function save(type, id, values, lastEditedAt, note) {
  const saved = await adapter.patch(type, id, values, ACTOR, lastEditedAt);
  await adapter.publish(type, id, ACTOR, saved.__lastEditedAt);
  console.log(`  ✓ ${note}`);
  return saved;
}

// --- load the wizard ---------------------------------------------------------

const { data: wizards } = await adapter.query('wizard', DRAFT);
const wizard = wizards[0];
if (!wizard) throw new Error('seed-wizard-branch-content: no wizard entry');

const { data: imageQuestions } = await adapter.query('image-question', DRAFT);
const { data: formQuestions } = await adapter.query('form-question', DRAFT);
const { data: options } = await adapter.query('image-option', DRAFT);
const { data: fields } = await adapter.query('form-field', DRAFT);

const questionIds = wizard.questions ?? [];
const stepAt = (i) =>
  imageQuestions.find((q) => q.__id === questionIds[i]) ??
  formQuestions.find((q) => q.__id === questionIds[i]);

const jobTypeStep = stepAt(0);
if (!jobTypeStep || !Array.isArray(jobTypeStep.options))
  throw new Error('seed-wizard-branch-content: step 1 is not an Image Question');

const jobTypes = jobTypeStep.options
  .map((id) => options.find((o) => o.__id === id))
  .filter(Boolean);

const byLabel = (needle) =>
  jobTypes.find((o) => new RegExp(needle, 'i').test(String(o.label ?? '')));

const renovation = byLabel('renovation');
const hourly = byLabel('handyman|hourly');

console.log(
  `job types: ${jobTypes.map((o) => `"${o.label}"`).join(', ')} — ` +
    `renovation=${renovation?.__id ?? 'MISSING'} hourly=${hourly?.__id ?? 'MISSING'}`
);
if (!renovation || !hourly)
  throw new Error(
    'seed-wizard-branch-content: could not identify both job types on step 1 by label'
  );

// --- 1. wizard goes full width ----------------------------------------------

console.log('1. full-width wizard');
const contactDetailsId = wizard.contactDetails;

if (!contactDetailsId) {
  console.log('  · wizard already has no contactDetails');
} else {
  await save('wizard', wizard.__id, { contactDetails: null }, wizard.__lastEditedAt,
    `wizard ${wizard.__id} — contactDetails cleared (was ${contactDetailsId})`);
}

if (contactDetailsId) {
  const { data: pages } = await adapter.query('page', {
    ...DRAFT,
    where: { key: { eq: 'contact' } },
  });
  const contactPage = pages[0];
  if (!contactPage) {
    console.warn('  ! no page with key "contact" — contact details not re-placed');
  } else {
    const sections = Array.isArray(contactPage.sections) ? contactPage.sections : [];
    if (sections.includes(contactDetailsId)) {
      console.log('  · contact page already holds the contact-details section');
    } else {
      await save('page', contactPage.__id, { sections: [...sections, contactDetailsId] },
        contactPage.__lastEditedAt,
        `page "contact" — contact-details appended below the wizard`);
    }
  }
}

// --- 2 + 3. the emergency switch --------------------------------------------

console.log('2+3. emergency switch');
const emergencyField = fields.find(
  (f) => f.inputType === 'boolean' && /emergency/i.test(String(f.fieldKey ?? f.label ?? ''))
);

if (!emergencyField) {
  console.warn('  ! no emergency boolean field found — skipped');
} else {
  const wantsAppliesTo = [hourly.__id];
  const already =
    emergencyField.isEmergencyFlag === true &&
    JSON.stringify(emergencyField.appliesTo ?? []) === JSON.stringify(wantsAppliesTo);

  if (already) {
    console.log('  · emergency field already configured');
  } else {
    await save('form-field', emergencyField.__id,
      { isEmergencyFlag: true, appliesTo: wantsAppliesTo },
      emergencyField.__lastEditedAt,
      `form-field "${emergencyField.label}" — flagged, shown for "${hourly.label}" only`);
  }
}

// The emergency window is the Timing step's, so it is set once on the step that
// holds the calendar — found by the availability field it contains rather than
// by its `stepLabel`, which is variant-driven and an editor may reword.
const availabilityField = fields.find((f) => f.inputType === 'availability');
const availabilityStep = availabilityField
  ? formQuestions.find((q) => (q.fields ?? []).includes(availabilityField.__id))
  : undefined;

if (!availabilityField) {
  console.warn('  ! no availability field found — emergency window skipped');
} else if (!availabilityStep) {
  console.warn(
    `  ! no Form Question holds availability field ${availabilityField.__id} — emergency window skipped`
  );
} else if (availabilityStep.emergencyHorizonDays === 7) {
  console.log('  · Timing step already has a 7-day emergency window');
} else {
  await save('form-question', availabilityStep.__id, { emergencyHorizonDays: 7 },
    availabilityStep.__lastEditedAt,
    `form-question "${availabilityStep.stepLabel}" — emergency window 7 days`);
}

// --- 4. mark the gated steps -------------------------------------------------

console.log('4. gated steps');
for (const index of [1, 2]) {
  const step = stepAt(index);
  if (!step || !Array.isArray(step.options)) {
    console.warn(`  ! step ${index + 1} is not an Image Question — skipped`);
    continue;
  }
  if (step.gatedBy === jobTypeStep.__id) {
    console.log(`  · "${step.stepLabel}" already gated by step 1`);
    continue;
  }
  await save('image-question', step.__id, { gatedBy: jobTypeStep.__id },
    step.__lastEditedAt,
    `image-question "${step.stepLabel}" — cards now chosen by "${jobTypeStep.stepLabel}"`);
}

// --- 5. Timing wording variants ---------------------------------------------

console.log('5. Timing wording variants');
const timingStep = formQuestions.find((q) => /timing/i.test(String(q.stepLabel ?? '')));

if (!timingStep) {
  console.warn('  ! no Timing step found — variants skipped');
} else if ((timingStep.variants ?? []).length > 0) {
  console.log(`  · Timing already has ${timingStep.variants.length} variant(s)`);
} else {
  // Order matters: the first match wins, so the emergency wording — which is
  // true regardless of job type — has to be tested before either job type.
  const VARIANTS = [
    {
      title: 'When can we get to you?',
      body: para(
        "Tell us the soonest days that work and we'll call you back to confirm a time. For an active leak or anything unsafe, ring us rather than waiting on this form."
      ),
      whenEmergency: 'only',
      appliesTo: [],
    },
    {
      title: 'When would you like the work to start?',
      body: para(
        'Pick the days that suit for a first visit. These are a preference, not a booking — we survey the property before agreeing a start date, and larger projects usually begin a few weeks after that.'
      ),
      whenEmergency: 'never',
      appliesTo: [renovation.__id],
    },
    {
      title: 'When would suit for a visit?',
      body: para(
        'Choose the days and times you can give us access. Hourly work is charged from arrival, so a slot you can definitely make is worth more than an early one you cannot.'
      ),
      whenEmergency: 'never',
      appliesTo: [hourly.__id],
    },
  ];

  const created = [];
  for (const variant of VARIANTS) {
    const entry = await adapter.create('step-copy', variant, ACTOR);
    await adapter.publish('step-copy', entry.__id, ACTOR, entry.__lastEditedAt);
    created.push(entry.__id);
    console.log(`  ✓ step-copy "${variant.title}" (${entry.__id})`);
  }

  await save('form-question', timingStep.__id, { variants: created },
    timingStep.__lastEditedAt,
    `form-question "${timingStep.stepLabel}" — ${created.length} wording variants linked`);
}

console.log('seed-wizard-branch-content: done.');
