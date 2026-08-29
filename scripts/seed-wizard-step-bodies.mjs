/**
 * Content seed (idempotent): fills in the rich-text introduction under each
 * wizard step's heading.
 *
 * The `body` field exists on every question but every one shipped empty, so the
 * feature was invisible — an editor opening the drawer saw a blank rich-text box
 * with nothing to tell them what belongs in it. Real copy is both the content
 * and the worked example.
 *
 * Each step gets one short paragraph doing a specific job:
 *   Project Type   — names the fork, because the whole rest of the form depends
 *                    on it and picking wrong wastes the visitor's time.
 *   Rooms/Location — says "roughly" out loud; people stall on forms that look
 *                    like they want a final answer.
 *   Services       — admits you may not know, which is what the Other card is for.
 *   Your Info      — says what happens next and why a postcode is being asked
 *                    for, which is the field people abandon on.
 *
 * The Timing step is deliberately skipped: its wording is already route-specific
 * through its three `step-copy` variants, and a base body would be dead text
 * that only shows if every variant stops matching.
 *
 * Matched by `stepLabel`, so re-ordering the wizard doesn't misfile the copy.
 * Only writes where `body` is empty — an editor's own words are never
 * overwritten, which also makes a re-run a no-op.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008); publishes what it changes.
 *
 * Usage: node scripts/seed-wizard-step-bodies.mjs
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
  if (!v) throw new Error(`seed-wizard-step-bodies: ${name} is required`);
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

const ACTOR = 'seed:wizard-step-bodies';
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 500 } };

const para = (text) => [{ type: 'paragraph', children: [{ type: 'text', text }] }];

/** stepLabel (case-insensitive) → the paragraph that belongs under its heading. */
const BODIES = {
  'project type': para(
    'This one choice shapes the rest of the form. A project is quoted as a fixed price after a site visit; hourly work is booked by the visit and charged for the time it takes.'
  ),
  'rooms/location': para(
    'Roughly is fine — tick everything you are thinking about, even the parts you are unsure of. Nothing here commits you to anything, and it helps us send someone with the right trades.'
  ),
  services: para(
    'If you are not sure what the job needs, that is normal and not a problem. Pick what you can and use Other to describe it in your own words.'
  ),
  'your info': para(
    'We use the postcode to check the address is inside our working area and to plan the visit. We reply by email or phone, usually the same working day, and we do not pass your details to anyone else.'
  ),
};

const { data: imageQuestions } = await adapter.query('image-question', DRAFT);
const { data: formQuestions } = await adapter.query('form-question', DRAFT);

const all = [
  ...imageQuestions.map((q) => ({ ...q, __type: 'image-question' })),
  ...formQuestions.map((q) => ({ ...q, __type: 'form-question' })),
];

let changes = 0;

for (const question of all) {
  const label = String(question.stepLabel ?? '').trim().toLowerCase();
  const body = BODIES[label];
  if (!body) continue;

  const existing = question.body;
  const hasBody = Array.isArray(existing) && existing.length > 0;
  if (hasBody) {
    console.log(`· "${question.stepLabel}" already has an introduction — left alone`);
    continue;
  }

  const saved = await adapter.patch(
    question.__type,
    question.__id,
    { body },
    ACTOR,
    question.__lastEditedAt
  );
  await adapter.publish(question.__type, question.__id, ACTOR, saved.__lastEditedAt);
  console.log(`✓ "${question.stepLabel}" — introduction added`);
  changes += 1;
}

console.log(
  changes === 0
    ? 'seed-wizard-step-bodies: already up to date.'
    : `seed-wizard-step-bodies: done — ${changes} step(s) filled in.`
);
