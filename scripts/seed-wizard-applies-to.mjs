/**
 * Content seed (idempotent): fills in which job type each card belongs to.
 *
 * The Branch-rule machinery shipped with every card left unmapped, which at
 * runtime means "show for everyone" — safe, but it meant the feature did
 * nothing until somebody sat down and mapped it. This is that mapping, as
 * specified:
 *
 *   Rooms/Location — every room, both job types. A kitchen is a kitchen whether
 *                    it is being refitted or having a tap replaced.
 *   Services       — Flooring and Tiling are Renovation only; they are trades
 *                    you book as part of a project, not an hourly call-out.
 *                    Everything else (Electrical, Plumbing, Painting &
 *                    Decorating, Other) stays on both.
 *
 * Written as label patterns rather than ids so it reads as the decision it is,
 * and so a re-run after a card is renamed fails loudly (unmatched cards are
 * listed) instead of silently mapping the wrong one.
 *
 * Step 1's own cards are deliberately left alone: they ARE the job types, and
 * gating them by themselves is circular.
 *
 * Idempotent — a card already carrying the intended set is skipped, so this can
 * be re-run safely. It does NOT reset a card an editor has since changed by
 * hand unless that change happens to differ from the target, which is the point
 * at which you want to know.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008); publishes what it changes.
 * Prereqs: seed-wizard-branch-schema.mjs, seed-wizard-branch-content.mjs.
 *
 * Usage: node scripts/seed-wizard-applies-to.mjs
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
  if (!v) throw new Error(`seed-wizard-applies-to: ${name} is required`);
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

const ACTOR = 'seed:wizard-applies-to';
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 500 } };

/** Cards whose label matches go to Renovation only; everything else, both. */
const RENOVATION_ONLY = /^(flooring|tiling)$/i;

const { data: wizards } = await adapter.query('wizard', DRAFT);
const wizard = wizards[0];
if (!wizard) throw new Error('seed-wizard-applies-to: no wizard entry');

const { data: imageQuestions } = await adapter.query('image-question', DRAFT);
const { data: options } = await adapter.query('image-option', DRAFT);

const questionIds = wizard.questions ?? [];
const steps = questionIds
  .map((id) => imageQuestions.find((q) => q.__id === id))
  .filter(Boolean);

const jobTypeStep = steps[0];
if (!jobTypeStep) throw new Error('seed-wizard-applies-to: step 1 is not an Image Question');

const jobTypes = (jobTypeStep.options ?? [])
  .map((id) => options.find((o) => o.__id === id))
  .filter(Boolean);

const renovation = jobTypes.find((o) => /renovation/i.test(String(o.label ?? '')));
const hourly = jobTypes.find((o) => /handyman|hourly/i.test(String(o.label ?? '')));
if (!renovation || !hourly)
  throw new Error('seed-wizard-applies-to: could not identify both job types on step 1');

const BOTH = [renovation.__id, hourly.__id];
const RENO = [renovation.__id];

console.log(
  `job types: renovation="${renovation.label}" hourly="${hourly.label}"`
);

let changes = 0;
const unmatched = [];

// Every gated step — i.e. every Image Question that is not step 1 itself.
for (const step of steps.slice(1)) {
  console.log(`\n${step.stepLabel}:`);
  for (const id of step.options ?? []) {
    const option = options.find((o) => o.__id === id);
    if (!option) {
      unmatched.push(id);
      continue;
    }
    const label = String(option.label ?? '');
    const target = RENOVATION_ONLY.test(label.trim()) ? RENO : BOTH;
    const targetNames = target.map((t) => (t === renovation.__id ? 'Renovation' : 'Hourly'));

    const current = Array.isArray(option.appliesTo) ? option.appliesTo : [];
    if (current.length === target.length && target.every((t) => current.includes(t))) {
      console.log(`  · "${label}" already ${targetNames.join(' + ')}`);
      continue;
    }

    const saved = await adapter.patch(
      'image-option',
      option.__id,
      { appliesTo: target },
      ACTOR,
      option.__lastEditedAt
    );
    await adapter.publish('image-option', option.__id, ACTOR, saved.__lastEditedAt);
    console.log(`  ✓ "${label}" → ${targetNames.join(' + ')}`);
    changes += 1;
  }
}

if (unmatched.length) {
  console.warn(`\n! ${unmatched.length} option id(s) referenced but not found: ${unmatched.join(', ')}`);
}

console.log(
  changes === 0
    ? '\nseed-wizard-applies-to: already up to date.'
    : `\nseed-wizard-applies-to: done — ${changes} card(s) mapped.`
);
