/**
 * Content seed (idempotent): the site's registered company name.
 *
 * Global Settings carried `legalName: "Upper Street Handyman Ltd."` — the
 * previous brand (nilo-construction / Upper Street Handyman), not the company
 * the site is for. It is one field, but it is not footer-only:
 *
 *   - footer.tsx renders `© {year} {legalName}. All rights reserved.`
 *   - local-business-json-ld.tsx emits it as the LocalBusiness `legalName`
 *   - helpers/metadata.ts uses it for `authors`, `creator` and `publisher`
 *
 * so the wrong value was a wrong structured-data claim on every page, not just
 * a typo in the legal bar.
 *
 * The footer strips a trailing period before appending its own ("…Handyman
 * Ltd." would have rendered "Ltd.."), so the stored value keeps the period the
 * way a company writes it and still renders one full stop.
 *
 * Reads with `status: 'draft', includeUnpublished: true` — queries default to
 * published (ADR 0006) and a previous run of this script leaves a draft, so a
 * default read cannot see its own work and the guard would never fire.
 *
 * Publishes the edit: an unpublished change to Global Settings is invisible to
 * the public site, which is the whole point of the fix. WRITES TO THE SHARED
 * LIVE Redis (ADR 0008). Same harness as
 * scripts/seed-single-whatsapp-number.mjs.
 *
 * Note it does NOT revalidate: `getSiteMetaConfig` caches for 600s and a
 * direct-to-Redis write fires no `revalidateTag`, so the footer can lag by up
 * to ten minutes. Restart the dev server (or wait) rather than assuming this
 * failed.
 *
 * Usage: node scripts/seed-legal-name.mjs
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
  if (!v) throw new Error(`seed-legal-name: ${name} is required`);
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

const ACTOR = 'seed:legal-name';
const TYPE = 'site-meta-config';

/** The registered company, written the way the company writes it. */
const LEGAL_NAME = 'Upper Street Contractors Ltd.';

/** See the header: this script's own prior write is a draft. */
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 100 } };

const { data: configs } = await adapter.query(TYPE, DRAFT);

if (configs.length === 0) {
  console.error(`seed-legal-name: no ${TYPE} entry — nothing to patch.`);
  process.exit(1);
}
if (configs.length > 1) {
  // getSiteMetaConfig reads the FIRST one, so a second is a silent second
  // source of truth for the footer, the JSON-LD and every page's metadata.
  console.warn(
    `seed-legal-name: ${configs.length} ${TYPE} entries (${configs
      .map((c) => c.__id)
      .join(', ')}) — only the first is ever read. Remove the extras in the CMS.`
  );
}

let changes = 0;

for (const config of configs) {
  if (config.legalName === LEGAL_NAME) {
    console.log(`legal-name: ${TYPE} ${config.__id} already "${LEGAL_NAME}"`);
    continue;
  }
  const saved = await adapter.patch(
    TYPE,
    config.__id,
    { legalName: LEGAL_NAME },
    ACTOR,
    config.__lastEditedAt
  );
  await adapter.publish(TYPE, config.__id, ACTOR, saved.__lastEditedAt);
  console.log(
    `legal-name: ${TYPE} ${config.__id} "${config.legalName ?? '(empty)'}" → "${LEGAL_NAME}"`
  );
  changes += 1;
}

console.log(
  changes === 0
    ? 'seed-legal-name: already up to date.'
    : `seed-legal-name: done — ${changes} entr${changes === 1 ? 'y' : 'ies'} updated.`
);
