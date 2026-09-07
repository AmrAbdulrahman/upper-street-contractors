/**
 * Schema + content seed (idempotent): the Social media and Theme tabs.
 *
 * Three jobs, all on the `site-meta-config` singleton.
 *
 * 1. **Social media tab.** `socialLinks` already existed — it is what
 *    `resolveWhatsAppUrl` reads for the site's one WhatsApp destination and
 *    what `LocalBusinessJsonLd` emits as schema.org `sameAs`. A second store
 *    for the footer's icons would be a set of profile URLs the structured data
 *    never sees, so the footer reads this one. Its tab is renamed `Social` →
 *    `Social media`, and the five missing platforms are seeded with neutral
 *    placeholder URLs for the client to replace.
 *
 * 2. **`socialNetworkName` becomes a `lookup`.** The footer keys each icon off
 *    this value; free text makes that a guess ("X", "Twitter", "x.com" all mean
 *    the same row and none of them match). The option list carries the two
 *    values already stored (WhatsApp, Google Maps) as well as the five new
 *    ones — a published value outside the set would fail `saveSchema`'s
 *    destructive-edit guard, which is exactly the check that makes this safe.
 *
 * 3. **Theme tab.** One `color` field per colour token in `globals.css`, all
 *    optional. Empty means "use the built-in", which is what lets Reset theme
 *    simply clear them: the defaults live in `globals.css` and are never copied
 *    into the store, so they cannot drift out of date. Each field carries its
 *    current value as a `preset` swatch.
 *
 * Additive except for the one `__type` change above, so the destructive-edit
 * guard passes. WRITES TO THE SHARED LIVE Redis (ADR 0008). Run
 * `nx codegen website --skip-nx-cache` afterwards, then restart dev.
 *
 * Usage: node scripts/seed-social-and-theme.mjs
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
  if (!v) throw new Error(`seed-social-and-theme: ${name} is required`);
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

const ACTOR = 'seed:social-and-theme';
const CONFIG = 'site-meta-config';
const LINK = 'social-link';

/** Queries default to published (ADR 0006) — a seed must see its own drafts. */
const DRAFT = { status: 'draft', includeUnpublished: true, page: { limit: 1000 } };

/**
 * The platforms the footer draws an icon for, in the order they appear there.
 * `Google Maps` is in the lookup's options but not here: it is a review
 * destination already carried in `sameAs`, not a social profile. WhatsApp is
 * absent for the same reason its buttons were removed everywhere else — the
 * pinned Quick Contact tab is the one WhatsApp affordance.
 */
const PLATFORMS = [
  { name: 'Facebook', url: 'https://www.facebook.com/' },
  { name: 'Instagram', url: 'https://www.instagram.com/' },
  { name: 'X', url: 'https://x.com/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/' },
  { name: 'TikTok', url: 'https://www.tiktok.com/' },
];

/** Every option the field may hold, incl. the two values already stored. */
const PLATFORM_OPTIONS = [...PLATFORMS.map((p) => p.name), 'WhatsApp', 'Google Maps'];

/**
 * One field per colour token in `globals.css`'s `@theme` block, `__name`
 * mirroring the CSS custom property so the injector can derive one from the
 * other rather than keeping a second mapping in sync.
 */
const THEME_FIELDS = [
  [
    'themeSurface',
    '--color-surface',
    '#f4f0e7',
    'Page background',
    'The warm off-white behind most sections.',
  ],
  [
    'themeWhite',
    '--color-white',
    '#f8fdf9',
    'Card white',
    'The near-white cards and panels sit on.',
  ],
  ['themeDark', '--color-dark', '#031021', 'Navy', 'The header, footer and dark bands.'],
  [
    'themeDark2',
    '--color-dark-2',
    '#020a15',
    'Navy — deeper',
    'The darker navy used for depth against the main one.',
  ],
  [
    'themeGold',
    '--color-gold',
    '#906d37',
    'Gold',
    'The primary brand colour: buttons, rules, accents.',
  ],
  [
    'themeGoldLight',
    '--color-gold-light',
    '#efe7d3',
    'Gold — light',
    'Pale gold washes and tinted backgrounds.',
  ],
  [
    'themeGoldMid',
    '--color-gold-mid',
    '#b8925a',
    'Gold — mid',
    'Gold on dark backgrounds, where the primary is too deep to read.',
  ],
  [
    'themeGoldDeep',
    '--color-gold-deep',
    '#7a5a2b',
    'Gold — deep',
    'Gold text on light backgrounds, and overlines.',
  ],
  [
    'themeForeground',
    '--color-foreground',
    '#031021',
    'Body text',
    'The default text colour.',
  ],
  [
    'themeMuted',
    '--color-muted',
    '#4a5a6b',
    'Muted text',
    'Secondary copy on a LIGHT background.',
  ],
  [
    'themeSubtle',
    '--color-subtle',
    '#7a8798',
    'Subtle text',
    'Secondary copy on a DARK background. Not interchangeable with Muted text.',
  ],
  ['themeBorder', '--color-border', '#d6cdb6', 'Border', 'Card and divider lines.'],
  [
    'themeBorderLight',
    '--color-border-light',
    '#e0d8c4',
    'Border — light',
    'The fainter divider.',
  ],
  [
    'themeWhatsapp',
    '--color-whatsapp',
    '#25d366',
    'WhatsApp green',
    "The vendor's brand green, used by the pinned contact tab.",
  ],
];

// --- schema -----------------------------------------------------------------

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const next = JSON.parse(JSON.stringify(schema));

const configType = next.find((t) => t.__name === CONFIG);
if (!configType) throw new Error(`seed-social-and-theme: no "${CONFIG}" Type in schema`);
const linkType = next.find((t) => t.__name === LINK);
if (!linkType) throw new Error(`seed-social-and-theme: no "${LINK}" Type in schema`);

let schemaChanged = false;

const socialLinksField = configType.fields.find((f) => f.__name === 'socialLinks');
if (socialLinksField && socialLinksField.group !== 'Social media') {
  socialLinksField.group = 'Social media';
  socialLinksField.label = 'Social profiles';
  socialLinksField.description =
    'Every profile the site links to. Also published as the business’s structured-data profile list, so a wrong URL here is a wrong claim to search engines.';
  schemaChanged = true;
  console.log('schema: socialLinks → tab "Social media"');
}

const nameField = linkType.fields.find((f) => f.__name === 'socialNetworkName');
if (nameField && nameField.__type !== 'lookup') {
  nameField.__type = 'lookup';
  nameField.options = PLATFORM_OPTIONS;
  nameField.label = 'Platform';
  nameField.description = 'Which platform this is. The footer draws its icon from this.';
  schemaChanged = true;
  console.log(
    `schema: ${LINK}.socialNetworkName text → lookup (${PLATFORM_OPTIONS.join(', ')})`
  );
} else if (nameField) {
  const missing = PLATFORM_OPTIONS.filter((o) => !(nameField.options ?? []).includes(o));
  if (missing.length) {
    nameField.options = [...(nameField.options ?? []), ...missing];
    schemaChanged = true;
    console.log(`schema: ${LINK}.socialNetworkName gained options ${missing.join(', ')}`);
  }
}

for (const [name, cssVar, value, label, description] of THEME_FIELDS) {
  const existing = configType.fields.find((f) => f.__name === name);
  if (existing) {
    if (existing.group !== 'Theme') {
      existing.group = 'Theme';
      schemaChanged = true;
    }
    continue;
  }
  configType.fields.push({
    __name: name,
    __type: 'color',
    label,
    description: `${description} Leave empty to use the built-in (${value}).`,
    presets: [value],
    group: 'Theme',
  });
  schemaChanged = true;
  console.log(`schema: added ${CONFIG}.${name} (color, ${cssVar})`);
}

if (schemaChanged) {
  await adapter.saveSchema(next, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

// --- content ----------------------------------------------------------------

const { data: links } = await adapter.query(LINK, DRAFT);
const byName = new Map(
  links.map((l) => [String(l.socialNetworkName ?? '').toLowerCase(), l])
);

const { data: configs } = await adapter.query(CONFIG, DRAFT);
const config = configs[0];
if (!config) throw new Error(`seed-social-and-theme: no "${CONFIG}" entry`);

const held = [...(config.socialLinks ?? [])];
let contentChanged = false;

for (const platform of PLATFORMS) {
  let link = byName.get(platform.name.toLowerCase());
  if (!link) {
    const created = await adapter.create(
      LINK,
      { socialNetworkName: platform.name, url: platform.url, description: null },
      ACTOR
    );
    await adapter.publish(LINK, created.__id, ACTOR, created.__lastEditedAt);
    link = created;
    console.log(`content: created ${LINK} "${platform.name}" → ${platform.url}`);
    contentChanged = true;
  } else {
    console.log(`content: ${LINK} "${platform.name}" already present — left alone`);
  }
  if (!held.includes(link.__id)) {
    held.push(link.__id);
    contentChanged = true;
  }
}

if (contentChanged) {
  const patched = await adapter.patch(
    CONFIG,
    config.__id,
    { socialLinks: held },
    ACTOR,
    config.__lastEditedAt
  );
  await adapter.publish(CONFIG, config.__id, ACTOR, patched.__lastEditedAt);
  console.log(`content: ${CONFIG}.socialLinks now holds ${held.length} profiles (published).`);
} else {
  console.log('content: already up to date.');
}

console.log('seed-social-and-theme: done.');
