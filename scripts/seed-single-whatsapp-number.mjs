/**
 * Content seed (idempotent): collapses the site onto ONE WhatsApp destination.
 *
 * The site shipped with two. Site chrome (header menu, footer, Quick Contact)
 * resolves `SiteMetaConfig.socialLinks` → the mobile `wa.me/447588376345`, while
 * every CMS `button` carrying a WhatsApp CTA hardcodes `wa.me/442074245466` —
 * the 020 landline — straight into its `href`. A visitor therefore reaches a
 * different number depending on which control they press, and only one of the
 * two is registered to WhatsApp.
 *
 * Two edits, both of which point at the same single resolver:
 *
 *   1. The `social-link` named WhatsApp is normalised to the agreed number and
 *      forced to https. It was stored as `http://`, which is a mixed-content
 *      link and — because the same string is emitted into the LocalBusiness
 *      JSON-LD `sameAs` array — an insecure structured-data claim as well.
 *   2. Every `button` whose `href` is a wa.me link has that href CLEARED and
 *      `action: 'whatsapp'` set instead. It is deliberately not rewritten to the
 *      new number: an href is a second copy of the number, and a second copy is
 *      how the site ended up with two in the first place. With the href gone the
 *      Button component resolves the destination through `resolveWhatsAppUrl`
 *      at render time, so changing the number in Settings changes it everywhere.
 *
 * Requires the Button component change that makes an action-only Button render
 * a real link (before it, clearing the href would render a dead `<button>`).
 *
 * Reads with `status: 'draft', includeUnpublished: true` — queries default to
 * published (ADR 0006) and this script's own previous run left drafts, so a
 * default read cannot see its own work and the guard would never fire.
 *
 * Publishes each edit it makes: these are live CTAs and a half-applied change
 * is exactly the two-number state being fixed. WRITES TO THE SHARED LIVE Redis
 * (ADR 0008). Same harness as scripts/seed-availability-content.mjs.
 *
 * Usage: node scripts/seed-single-whatsapp-number.mjs
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
  if (!v) throw new Error(`seed-single-whatsapp-number: ${name} is required`);
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

const ACTOR = 'seed:single-whatsapp';

/** The one number, agreed with the client. Digits only, country code included. */
const WHATSAPP_NUMBER = '447588376345';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

/** See the header: this script's own prior writes are drafts. */
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 1000 } };

/** Any wa.me / api.whatsapp.com link, whatever scheme or number it carries. */
const WA_HREF = /^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com)\b/i;

let changes = 0;

// --- 1. the social-link the whole site chrome resolves through ---------------

const { data: socialLinks } = await adapter.query('social-link', DRAFT);
const whatsappLinks = socialLinks.filter((l) =>
  String(l.socialNetworkName ?? '').toLowerCase().includes('whatsapp')
);

if (whatsappLinks.length === 0) {
  console.log('whatsapp: no social-link named WhatsApp — site chrome will fall back to phoneNumber');
} else if (whatsappLinks.length > 1) {
  // resolveWhatsAppUrl takes the FIRST match, so a second one is a silent
  // second number waiting to be picked up by a reordering.
  console.warn(
    `whatsapp: ${whatsappLinks.length} social-links match "whatsapp" (${whatsappLinks
      .map((l) => l.__id)
      .join(', ')}) — only the first is ever used. Remove the extras in the CMS.`
  );
}

for (const link of whatsappLinks) {
  if (link.url === WHATSAPP_URL) {
    console.log(`whatsapp: social-link ${link.__id} already ${WHATSAPP_URL}`);
    continue;
  }
  const saved = await adapter.patch(
    'social-link',
    link.__id,
    { url: WHATSAPP_URL },
    ACTOR,
    link.__lastEditedAt
  );
  await adapter.publish('social-link', link.__id, ACTOR, saved.__lastEditedAt);
  console.log(`whatsapp: social-link ${link.__id} ${link.url ?? '(empty)'} → ${WHATSAPP_URL}`);
  changes += 1;
}

// --- 2. every button that hardcodes a number into its href ------------------

const { data: buttons } = await adapter.query('button', DRAFT);
const hardcoded = buttons.filter((b) => WA_HREF.test(String(b.href ?? '')));

if (hardcoded.length === 0) {
  console.log('whatsapp: no button hardcodes a wa.me href');
}

for (const button of hardcoded) {
  const saved = await adapter.patch(
    'button',
    button.__id,
    { href: null, action: 'whatsapp' },
    ACTOR,
    button.__lastEditedAt
  );
  await adapter.publish('button', button.__id, ACTOR, saved.__lastEditedAt);
  console.log(
    `whatsapp: button ${button.__id} "${button.label ?? '(no label)'}" — dropped href ${button.href}, action=whatsapp`
  );
  changes += 1;
}

console.log(
  changes === 0
    ? 'seed-single-whatsapp-number: already up to date.'
    : `seed-single-whatsapp-number: done — ${changes} entr${changes === 1 ? 'y' : 'ies'} updated.`
);
