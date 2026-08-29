/**
 * Schema + content seed (idempotent): makes the enquiry CTA the loudest thing
 * in every button row, and the first one read.
 *
 * The site's primary conversion action was styled like a secondary: white or
 * outlined, and usually placed AFTER the WhatsApp button, so in every pair the
 * quieter control was the one the business actually wants pressed. Two changes:
 *
 *   1. Schema — add `gold` to the `button.color` lookup. The brand colour was
 *      not an option an editor could pick at all; the palette was green /
 *      dark_blue / white / black. White label text on `--color-gold` (#906D37)
 *      measures 4.74:1, over the 4.5:1 AA floor.
 *   2. Content — every button whose destination is the enquiry form becomes
 *      `contained` + `gold`, and is hoisted to the FRONT of whatever list holds
 *      it. The hoist walks the schema for any `references` field that accepts
 *      `button`, so a new section Type with a button row is covered without
 *      touching this script.
 *
 * "Destination is the enquiry form" means `action: contact_form`, or an href
 * pointing at /contact, or a label mentioning a quote. That deliberately
 * catches "Request a Site Visit" and "Book a Consultation" too — three labels
 * for one outcome is its own problem, but they are all the primary CTA of the
 * page they sit on and they should all look like it.
 *
 * Order within the list is otherwise preserved (stable partition), so a row of
 * three keeps its remaining two in the order an editor put them.
 *
 * Requires the matching code change (`BUTTON_COLORS` + `buttonStyles` gain
 * `gold`); without it `normalizeButtonColor` falls back to green. Run
 * `nx cms-schema website && nx codegen website` afterwards so the generated
 * ButtonColor enum picks the new option up.
 *
 * Reads with `status: 'draft', includeUnpublished: true` (ADR 0006 — a default
 * read is published-only and cannot see this script's own prior run) and
 * publishes what it changes, because these are live CTAs. WRITES TO THE SHARED
 * LIVE Redis (ADR 0008).
 *
 * Usage: node scripts/seed-primary-cta-prominence.mjs
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
  if (!v) throw new Error(`seed-primary-cta-prominence: ${name} is required`);
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

const ACTOR = 'seed:primary-cta';
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 1000 } };
const GOLD = 'gold';

let changes = 0;

// --- 1. schema: `gold` joins the button colour options -----------------------

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));

const buttonType = next.find((t) => t.__name === 'button');
if (!buttonType) throw new Error('seed-primary-cta-prominence: no "button" Type in schema');

const colorField = (buttonType.fields ?? []).find((f) => f.__name === 'color');
if (!colorField) throw new Error('seed-primary-cta-prominence: "button" has no "color" field');
if (colorField.__type !== 'lookup')
  throw new Error(`seed-primary-cta-prominence: "button.color" is "${colorField.__type}", expected "lookup"`);

colorField.options = colorField.options ?? [];
if (colorField.options.includes(GOLD)) {
  console.log('schema: "button.color" already offers gold');
} else {
  colorField.options.push(GOLD);
  await adapter.saveSchema(next, ACTOR, version);
  console.log(`schema: "button.color" options ${colorField.options.join(' | ')}`);
  changes += 1;
}

// --- 2. which buttons are the primary CTA -----------------------------------

const QUOTE_LABEL = /\b(quote|site visit|consultation|get started|book a repair)\b/i;

const isPrimaryCta = (b) =>
  b.action === 'contact_form' ||
  /^\/contact\b/.test(String(b.href ?? '')) ||
  QUOTE_LABEL.test(String(b.label ?? ''));

const { data: buttons } = await adapter.query('button', DRAFT);
const primaries = buttons.filter(isPrimaryCta);
const primaryIds = new Set(primaries.map((b) => b.__id));

console.log(
  `cta: ${primaries.length} primary CTA button(s): ${primaries.map((b) => `"${b.label}"`).join(', ')}`
);

// --- 3. restyle each one -----------------------------------------------------

for (const button of primaries) {
  if (button.color === GOLD && button.variant === 'contained') {
    console.log(`cta: button ${button.__id} "${button.label}" already gold/contained`);
    continue;
  }
  const saved = await adapter.patch(
    'button',
    button.__id,
    { color: GOLD, variant: 'contained' },
    ACTOR,
    button.__lastEditedAt
  );
  await adapter.publish('button', button.__id, ACTOR, saved.__lastEditedAt);
  console.log(
    `cta: button ${button.__id} "${button.label}" — ${button.variant ?? 'null'}/${button.color ?? 'null'} → contained/gold`
  );
  changes += 1;
}

// --- 4. hoist to the front of every list that holds one ---------------------

// Any `references` field anywhere in the schema whose allowedTypes accept a
// button. Derived rather than hand-listed so a new section with a button row is
// covered the day it is added.
const holders = [];
for (const type of schema) {
  for (const field of type.fields ?? []) {
    if (field.__type === 'references' && (field.allowedTypes ?? []).includes('button')) {
      holders.push({ type: type.__name, field: field.__name });
    }
  }
}
console.log(
  `cta: ${holders.length} button list(s) in the schema: ${holders.map((h) => `${h.type}.${h.field}`).join(', ')}`
);

for (const holder of holders) {
  const { data: entries } = await adapter.query(holder.type, DRAFT);
  for (const entry of entries) {
    const before = entry[holder.field];
    if (!Array.isArray(before) || before.length < 2) continue;

    // Stable partition: primaries first, everything else in its existing order.
    const after = [
      ...before.filter((id) => primaryIds.has(id)),
      ...before.filter((id) => !primaryIds.has(id)),
    ];
    if (after.every((id, i) => id === before[i])) continue;

    const saved = await adapter.patch(
      holder.type,
      entry.__id,
      { [holder.field]: after },
      ACTOR,
      entry.__lastEditedAt
    );
    await adapter.publish(holder.type, entry.__id, ACTOR, saved.__lastEditedAt);
    console.log(`cta: ${holder.type}.${holder.field} ${entry.__id} — reordered, CTA now first`);
    changes += 1;
  }
}

console.log(
  changes === 0
    ? 'seed-primary-cta-prominence: already up to date.'
    : `seed-primary-cta-prominence: done — ${changes} change(s).`
);
