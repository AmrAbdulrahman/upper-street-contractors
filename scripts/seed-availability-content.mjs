/**
 * Content seed: swaps the Enquiry Wizard's Timing step over to the Availability
 * field. Writes DRAFTS ONLY (create → draft, patch → draft), so live visitors
 * see no change until an Editor hits "Publish all changes" in Inspect mode.
 *
 * Before: Timing step = `emergency` (boolean) + `renovationDate` (date) +
 *         `timeWindow` (timeWindow) — one date, and slots belonging to nothing.
 * After:  Timing step = `emergency` (boolean) + `preferredVisit` (availability)
 *         — many days, and Time windows per day.
 *
 * Every read here passes `status: 'draft', includeUnpublished: true`. Queries
 * default to `published` (ADR 0006), and everything this script writes is a
 * draft — without that the idempotence guard can't see its own previous run and
 * the swap gets applied twice, against the stale published field list.
 *
 * The two replaced `form-field` entries are unlinked from the step and then
 * deleted, so they don't linger as orphans in the Content admin. Reference
 * integrity counts PUBLISHED values, so on the first run the deletes are refused
 * (the published step still links them) — expected, and not fatal: the swap
 * itself has already landed. Publish the wizard, re-run this script, and the
 * leftovers go.
 *
 * Idempotent: once the step's draft links a `preferredVisit` field the swap is
 * skipped, and the run just retries the cleanup (leftovers + any duplicate
 * `preferredVisit` field a pre-guard run created).
 *
 * Prereq: run scripts/seed-availability-schema.mjs first (the inputType option
 * and the four config attributes must exist). WRITES TO THE SHARED LIVE Redis
 * (ADR 0008) — drafts only. Same harness as scripts/seed-faq-timing-content.mjs.
 *
 * Usage: node scripts/seed-availability-content.mjs
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
  if (!v) throw new Error(`seed-availability-content: ${name} is required`);
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

/** The two fields the Availability field replaces, by fieldKey. */
const REPLACED_KEYS = ['renovationDate', 'timeWindow'];
const NEW_KEY = 'preferredVisit';

/** See the header: drafts are invisible to a default (published) read. */
const DRAFT_READ = { status: 'draft', includeUnpublished: true };

async function fieldsByKey(fieldKey) {
  const found = await adapter.query('form-field', {
    where: { fieldKey: { eq: fieldKey } },
    ...DRAFT_READ,
    page: { limit: 20 },
  });
  return found.data;
}

/** Delete unlinked leftovers; a refusal is reported, never fatal. */
async function tryDelete(entries, why) {
  for (const f of entries) {
    try {
      await adapter.delete('form-field', f.__id, ACTOR, f.__lastEditedAt);
      console.log(`availability: deleted ${why} form-field "${f.fieldKey}" (${f.__id})`);
    } catch (err) {
      console.warn(
        `availability: "${f.fieldKey}" (${f.__id}) is unlinked from the step but still referenced ` +
          `by the published step — publish the wizard, then re-run this script to delete it. ` +
          `Reason: ${err?.message ?? err}`
      );
    }
  }
}

// --- read the current draft state -------------------------------------------
const replaced = (await Promise.all(REPLACED_KEYS.map(fieldsByKey))).flat();
const replacedIds = new Set(replaced.map((f) => f.__id));

const availability = await fieldsByKey(NEW_KEY);
const availabilityIds = new Set(availability.map((f) => f.__id));

const questions = await adapter.query('form-question', { ...DRAFT_READ, page: { limit: 100 } });
const target = questions.data.find((q) =>
  (Array.isArray(q.fields) ? q.fields : []).some(
    (id) => replacedIds.has(id) || availabilityIds.has(id)
  )
);

if (!target)
  throw new Error(
    `seed-availability-content: no form-question holds ${REPLACED_KEYS.join('/')} or ${NEW_KEY} — ` +
      'run scripts/seed-faq-timing-content.mjs first'
  );

const before = Array.isArray(target.fields) ? [...target.fields] : [];
const alreadyLinked = before.filter((id) => availabilityIds.has(id));

// --- swap, unless a previous run already did it ------------------------------
if (alreadyLinked.length > 0) {
  console.log(
    `availability: step ${target.__id} already links ${NEW_KEY} (${alreadyLinked[0]}) — swap already done`
  );
} else {
  const created = await adapter.create(
    'form-field',
    {
      label: 'Preferred time of day',
      fieldKey: NEW_KEY,
      inputType: 'availability',
      // The visitor must give us at least one day, and a time on one of them.
      required: true,
      // maxDates / earliestOffsetDays / horizonMonths / allowWeekends left unset
      // so the schema defaults apply (5 / 0 / 6 / true) — an editor tunes them
      // in the Edit drawer.
    },
    ACTOR
  );
  console.log(`availability: created form-field "${NEW_KEY}" (${created.__id})`);
  availability.push(created);
  alreadyLinked.push(created.__id);

  // Take the first replaced field's slot, so the step keeps its reading order.
  const insertAt = before.findIndex((id) => replacedIds.has(id));
  const after = before.filter((id) => !replacedIds.has(id));
  after.splice(insertAt >= 0 ? insertAt : after.length, 0, created.__id);

  await adapter.patch(
    'form-question',
    target.__id,
    {
      fields: after,
      hint: 'Pick any days that suit — you can choose more than one, and set the times that work on each.',
    },
    ACTOR,
    target.__lastEditedAt
  );
  console.log(
    `availability: patched form-question ${target.__id} — fields ${before.length} → ${after.length}, ` +
      `${NEW_KEY} at index ${after.indexOf(created.__id)} (DRAFT)`
  );
}

// --- cleanup ----------------------------------------------------------------
const keep = alreadyLinked[0];
const duplicates = availability.filter((f) => f.__id !== keep);
if (duplicates.length) await tryDelete(duplicates, `duplicate ${NEW_KEY}`);

if (replaced.length) await tryDelete(replaced, 'orphaned');
else console.log('availability: no replaced fields left to clean up');

console.log('seed-availability-content: done.');
