/**
 * Content seed (idempotent): rewrites the Timing step so it reads as the visit
 * being booked, not a wish list — and gives the step a base introduction.
 *
 * The wording shipped hedged ("these are your preferences, we'll confirm the
 * actual appointment with you"), which is the safer sentence and the wrong one:
 * hedged copy invites somebody to tick a day they cannot actually do, and then
 * the visit gets rearranged anyway. These are the days and times USC will
 * attend, so the copy commits.
 *
 * That commitment is only honest because the calendar already refuses days the
 * business does not work (Sunday comes off in `CLOSED_WEEKDAYS`, weekends are
 * per-field, and an emergency shortens the window to 7 days). If those ever
 * stop matching the published opening hours, this copy becomes a promise the
 * business cannot keep — the two have to move together.
 *
 * Also adds a base `body` to the Timing question. Its three wording variants
 * already cover every route, so this only shows if none match — but "each step
 * has an introduction" should be true of every step, including in the drawer
 * where an editor is looking for the field.
 *
 * Overwrites the three seeded variants by id-free label match, so an editor's
 * own rewording is preserved: only text this script itself wrote is replaced.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008); publishes what it changes.
 *
 * Usage: node scripts/seed-timing-is-an-appointment.mjs
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
  if (!v) throw new Error(`seed-timing-is-an-appointment: ${name} is required`);
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

const ACTOR = 'seed:timing-appointment';
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 500 } };

const para = (text) => [{ type: 'paragraph', children: [{ type: 'text', text }] }];

/**
 * The old hedged sentences this script is allowed to replace. Anything else is
 * an editor's own words and is left alone.
 */
const SEEDED_BEFORE =
  /preference|we survey the property|worth more than an early one|call you back to confirm/i;

/** Variant title → the copy it should now carry. */
const VARIANTS = {
  'when can we get to you': {
    title: 'When can we come out?',
    body: para(
      'Pick the days and times you can give us access. We attend on the slot you choose, so only tick what you can definitely make. If it is an active leak or anything unsafe, ring us instead of waiting on this form.'
    ),
  },
  'when would you like the work to start': {
    title: 'When should we start?',
    body: para(
      'Choose the days and times you want us on site. These are the slots we work to, so pick ones you can be there for — if the start date needs to move once the survey is done, we will agree that with you first.'
    ),
  },
  'when would suit for a visit': {
    title: 'When should we come?',
    body: para(
      'Choose the days and times you want us there. We book the slot you pick and turn up in it, so choose one you can definitely make — hourly work is charged from arrival.'
    ),
  },
};

const TIMING_BODY = para(
  'Tell us when you want us on site. Whatever you choose here is the slot we work to, so pick days and times you can definitely make.'
);

let changes = 0;

// --- the base introduction on the Timing step --------------------------------

const { data: formQuestions } = await adapter.query('form-question', DRAFT);
const timing = formQuestions.find((q) => /timing/i.test(String(q.stepLabel ?? '')));

if (!timing) {
  console.warn('! no Timing step found');
} else if (Array.isArray(timing.body) && timing.body.length > 0) {
  console.log('· Timing already has an introduction — left alone');
} else {
  const saved = await adapter.patch('form-question', timing.__id, { body: TIMING_BODY }, ACTOR, timing.__lastEditedAt);
  await adapter.publish('form-question', timing.__id, ACTOR, saved.__lastEditedAt);
  console.log('✓ Timing — base introduction added');
  changes += 1;
}

// --- the three wording variants ---------------------------------------------

const { data: stepCopies } = await adapter.query('step-copy', DRAFT);

for (const copy of stepCopies) {
  const key = Object.keys(VARIANTS).find((k) =>
    String(copy.title ?? '').toLowerCase().startsWith(k)
  );
  if (!key) continue;

  const target = VARIANTS[key];
  const bodyText = JSON.stringify(copy.body ?? '');

  if (copy.title === target.title && !SEEDED_BEFORE.test(bodyText)) {
    console.log(`· "${copy.title}" already updated — left alone`);
    continue;
  }
  if (copy.title !== target.title && !SEEDED_BEFORE.test(bodyText)) {
    console.log(`· "${copy.title}" has been reworded by hand — left alone`);
    continue;
  }

  const saved = await adapter.patch(
    'step-copy',
    copy.__id,
    { title: target.title, body: target.body },
    ACTOR,
    copy.__lastEditedAt
  );
  await adapter.publish('step-copy', copy.__id, ACTOR, saved.__lastEditedAt);
  console.log(`✓ "${copy.title}" → "${target.title}"`);
  changes += 1;
}

console.log(
  changes === 0
    ? 'seed-timing-is-an-appointment: already up to date.'
    : `seed-timing-is-an-appointment: done — ${changes} change(s).`
);
