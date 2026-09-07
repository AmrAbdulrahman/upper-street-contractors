/**
 * Content + schema seed (idempotent): retires the WhatsApp CMS Button.
 *
 * The site now has exactly one WhatsApp affordance — the Quick Contact tab
 * pinned to every page. Every other one is gone: the footer's contact row, the
 * mobile menu's button, the Contact Details panel's, and the CTA bands' Buttons,
 * which are these entries.
 *
 * Two steps, in this order and no other:
 *
 * 1. **Force-delete each `button` whose action is `whatsapp`.** Force, because
 *    they are held by published `planning-renovation-section` entries and an
 *    ordinary delete is refused while anything points at them. This rewrites
 *    those sections' live values — that is the intent, and it is why the copy
 *    on the Force delete button in the CMS says so.
 * 2. **Drop `whatsapp` from `button.action`'s options.** Only once no entry
 *    holds the value: `saveSchema`'s destructive-edit guard validates every
 *    published entry against the new schema, so doing this first would be
 *    refused — correctly.
 *
 * Without step 2 an editor could still pick an action the code no longer
 * resolves, and get a button that goes nowhere.
 *
 * WRITES TO THE SHARED LIVE Redis (ADR 0008). Direct writes never fire
 * `revalidateTag`, so curl the running server rather than trusting the browser.
 * Run `nx codegen website --skip-nx-cache` afterwards.
 *
 * Usage: node scripts/seed-retire-whatsapp-buttons.mjs
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
  if (!v) throw new Error(`seed-retire-whatsapp-buttons: ${name} is required`);
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

const ACTOR = 'seed:retire-whatsapp-buttons';
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 1000 } };

// --- 1. the Buttons ---------------------------------------------------------

const { data: buttons } = await adapter.query('button', DRAFT);
const whatsappButtons = buttons.filter((b) =>
  String(b.action ?? '')
    .toLowerCase()
    .includes('whats')
);

if (whatsappButtons.length === 0) {
  console.log('buttons: none with a whatsapp action — already retired.');
}

for (const button of whatsappButtons) {
  // Force: these are held by published sections, and the whole point is that
  // the sections stop holding them.
  await adapter.delete('button', button.__id, ACTOR, button.__lastEditedAt, true);
  console.log(
    `buttons: force-deleted "${button.label ?? button.__id}" (${button.__id}) and unlinked it everywhere`
  );
}

// --- 2. the option ----------------------------------------------------------

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));

const action = next
  .find((t) => t.__name === 'button')
  ?.fields.find((f) => f.__name === 'action');

if (!action) throw new Error('seed-retire-whatsapp-buttons: no button.action field');

if ((action.options ?? []).includes('whatsapp')) {
  action.options = action.options.filter((o) => o !== 'whatsapp');
  await adapter.saveSchema(next, ACTOR, version);
  console.log(`schema: button.action options are now [${action.options.join(', ')}]`);
} else {
  console.log('schema: button.action already has no whatsapp option.');
}

// --- 3. the Contact Details panel's own button field -------------------------

// The panel no longer renders it, and a field left declared is an invitation to
// put a WhatsApp button back on the one page that still had room for it.
// Removing a field is safe here for the reason the guard exists: `saveSchema`
// validates PROJECTED values, so a key the Type no longer declares is simply
// never surfaced (ADR 0011).
const schemaAfter = await adapter.getSchema();
const versionAfter = await adapter.getSchemaVersion();
const nextAfter = JSON.parse(JSON.stringify(schemaAfter));
const contactDetails = nextAfter.find((t) => t.__name === 'contact-details');

if (contactDetails?.fields.some((f) => f.__name === 'whatsappButton')) {
  contactDetails.fields = contactDetails.fields.filter(
    (f) => f.__name !== 'whatsappButton'
  );
  await adapter.saveSchema(nextAfter, ACTOR, versionAfter);
  console.log('schema: removed contact-details.whatsappButton');
} else {
  console.log('schema: contact-details has no whatsappButton field.');
}

console.log('seed-retire-whatsapp-buttons: done.');
