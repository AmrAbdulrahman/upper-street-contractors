/**
 * Migration (idempotent): moves the Availability calendar's five config
 * attributes off `form-field` and onto the Timing step (`form-question`).
 *
 *   maxDates · earliestOffsetDays · horizonMonths · allowWeekends ·
 *   emergencyHorizonDays
 *
 * ## Why
 *
 * `form-field` is ONE flat Type shared by every wizard input, so five settings
 * that only the Availability calendar ever reads were showing in all ~15 field
 * drawers — text, email, tel, file, boolean alike. The `Availability:` label
 * prefix was the only thing keeping that legible.
 *
 * It had already gone wrong: seed-wizard-branch-content.mjs wrote
 * `emergencyHorizonDays: 7` onto the emergency BOOLEAN field as well as the
 * calendar, where it is dead — only the calendar's own copy is ever read. The
 * same number, stored twice, one copy inert.
 *
 * The Timing step is the entry that owns both halves of the feature: the
 * emergency toggle and the calendar that toggle clamps. The settings belong to
 * neither field alone, so they go to the step.
 *
 * BEHAVIOUR IS UNCHANGED. One window; the emergency toggle still only ever
 * NARROWS it via min(), never opens a date the normal horizon refused.
 *
 * ## Phases
 *
 *   1. Assert `form-question` already declares all five. They are added by
 *      scripts/seed-availability-schema.mjs (four) and
 *      scripts/seed-wizard-branch-schema.mjs (emergencyHorizonDays) — run both
 *      first. Nothing is invented here.
 *   2. For each `form-question` holding an Availability field, copy that
 *      field's config up onto the step, then re-publish only what was already
 *      published. Values are copied VERBATIM — ADR 0011 read-time projection
 *      means an unset attribute already reads as its schema default, which is
 *      exactly the number the widget was using, so copying it preserves
 *      behaviour precisely.
 *   3. Remove the five from the `form-field` Type. Safe per ADR 0011: the guard
 *      validates the PROJECTED bag, and projection drops a stored key the Type
 *      no longer declares — the leftovers in Redis are unreadable and cannot
 *      invalidate anything. `--keep-old` stops before this.
 *
 * Phase 3 is also what makes a re-run a no-op: with the keys gone from
 * `form-field`, phase 2 finds nothing left to copy.
 *
 * The Timing step is found by THE AVAILABILITY FIELD IT CONTAINS, never by
 * `/timing/i.test(stepLabel)`. Three other scripts match on that label and a
 * rename detaches them all silently; this one must not become a fourth.
 *
 * Reads with `status: 'draft', includeUnpublished: true` (ADR 0006) — a query
 * defaults to published, so otherwise this could not see its own prior run.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Going through the adapter
 * directly bypasses `withRevalidate` in apps/website/src/lib/zero-cms/server.ts,
 * so public pages stay stale until `next dev` (or the deploy) restarts.
 *
 * Afterwards:
 *   npx nx cms-schema website --skip-nx-cache && npx nx codegen website --skip-nx-cache
 *
 * Usage: node scripts/seed-timing-config-to-step.mjs [--keep-old]
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
  if (!v) throw new Error(`seed-timing-config-to-step: ${name} is required`);
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

const ACTOR = 'seed:timing-config-to-step';
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 500 } };
const keepOld = process.argv.includes('--keep-old');

/** The five that move. Order is the order they read in a drawer. */
const CONFIG_KEYS = [
  'maxDates',
  'earliestOffsetDays',
  'horizonMonths',
  'allowWeekends',
  'emergencyHorizonDays',
];

// --- phase 1: the destination must already exist -----------------------------

const schema = await adapter.getSchema();

const formQuestionType = schema.find((t) => t.__name === 'form-question');
if (!formQuestionType)
  throw new Error('seed-timing-config-to-step: no "form-question" Type in schema');

const missing = CONFIG_KEYS.filter(
  (key) => !(formQuestionType.fields ?? []).some((f) => f.__name === key)
);
if (missing.length)
  throw new Error(
    `seed-timing-config-to-step: "form-question" is missing ${missing.join(', ')}. ` +
      'Run scripts/seed-availability-schema.mjs and scripts/seed-wizard-branch-schema.mjs first.'
  );

const formFieldType = schema.find((t) => t.__name === 'form-field');
if (!formFieldType) throw new Error('seed-timing-config-to-step: no "form-field" Type in schema');

const stillOnField = CONFIG_KEYS.filter((key) =>
  (formFieldType.fields ?? []).some((f) => f.__name === key)
);
console.log(
  stillOnField.length
    ? `phase 1: ok. "form-field" still declares ${stillOnField.join(', ')}.`
    : 'phase 1: ok. "form-field" already carries none of them — content move will be a no-op.'
);

// --- phase 2: copy each calendar's config up to its step ---------------------

const { data: formQuestions } = await adapter.query('form-question', DRAFT);
const { data: formFields } = await adapter.query('form-field', DRAFT);

const fieldById = new Map(formFields.map((f) => [f.__id, f]));

/** Only the keys this field actually carries a value for. */
const configOf = (field) => {
  const out = {};
  for (const key of CONFIG_KEYS) {
    const value = field[key];
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
};

let moved = 0;
let skipped = 0;

for (const step of formQuestions) {
  const calendars = (step.fields ?? [])
    .map((id) => fieldById.get(id))
    .filter((f) => f && f.inputType === 'availability');

  if (calendars.length === 0) continue;

  const label = step.stepLabel ?? step.title ?? step.__id;
  const config = configOf(calendars[0]);

  // Two calendars in one step would each want to own the step's settings.
  // Nothing in the CMS forbids it, so fail loudly rather than silently picking
  // the first one's numbers and quietly changing the second one's behaviour.
  for (const other of calendars.slice(1)) {
    const otherConfig = configOf(other);
    const clash = CONFIG_KEYS.filter(
      (key) => key in config && key in otherConfig && config[key] !== otherConfig[key]
    );
    if (clash.length)
      throw new Error(
        `seed-timing-config-to-step: form-question "${label}" holds ${calendars.length} ` +
          `availability fields whose config disagrees on ${clash.join(', ')}. ` +
          'Reconcile them in the CMS first — this script will not choose for you.'
      );
    Object.assign(config, otherConfig);
  }

  const changes = Object.fromEntries(
    Object.entries(config).filter(([key, value]) => step[key] !== value)
  );

  if (Object.keys(changes).length === 0) {
    console.log(`  · form-question "${label}": already up to date`);
    skipped += 1;
    continue;
  }

  const patched = await adapter.patch('form-question', step.__id, changes, ACTOR, step.__lastEditedAt);
  // Only re-publish what was already public; an unpublished draft stays one.
  if (step.__status === 'published') {
    await adapter.publish('form-question', step.__id, ACTOR, patched.__lastEditedAt);
  }

  const summary = Object.entries(changes)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  console.log(`  ✓ form-question "${label}": ${summary}`);
  moved += 1;
}

console.log(`phase 2: ${moved} step(s) updated, ${skipped} already correct.`);

if (keepOld) {
  console.log('seed-timing-config-to-step: --keep-old, stopping before phase 3.');
  process.exit(0);
}

// --- phase 3: drop the five from form-field ----------------------------------

{
  const current = await adapter.getSchema();
  const version = await adapter.getSchemaVersion();
  const next = JSON.parse(JSON.stringify(current));

  const type = next.find((t) => t.__name === 'form-field');
  const before = type.fields.length;
  type.fields = type.fields.filter((f) => !CONFIG_KEYS.includes(f.__name));
  const removed = before - type.fields.length;

  if (removed === 0) {
    console.log('phase 3: "form-field" already carries none of them.');
  } else {
    await adapter.saveSchema(next, ACTOR, version);
    console.log(`phase 3: removed ${removed} field(s) from "form-field". Saved.`);
  }
}

console.log('seed-timing-config-to-step: done.');
