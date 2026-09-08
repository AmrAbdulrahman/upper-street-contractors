/**
 * Seed the /about redesign: Story Timeline + Value tabs.
 *
 * 1. Schema (idempotent, additive only — clears saveSchema's destructive-edit
 *    guard): adds a `title` field to `prose-section`, and four new Types —
 *    `story-timeline-section` + `milestone`, `values-section` + `value-item` —
 *    registering the two section Types on `page.sections.allowedTypes` only.
 *    They are About-page furniture; the blog/project Type pickers stay clean.
 * 2. Media: downloads 11 Unsplash photos (free commercial licence) at a fixed
 *    1920x1080 crop — the crop is requested in the URL so putMedia's width and
 *    height are known without parsing a JPEG header.
 * 3. Content: creates + publishes 6 Milestones, 5 Values, the two sections and
 *    the intro ProseSection, then rewires `about-us`'s `sections` to
 *    [page-hero, prose intro, story timeline, values] and publishes the page.
 *
 * Everything below the hero comes OFF the page here. The unlinked entries are
 * left in the store; scripts/prune-about-orphans.mjs deletes them separately.
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008: one Upstash Redis + Vercel Blob
 * behind local/staging/prod). Entries are published immediately. Idempotent:
 * schema edits are skipped when present, media is matched by filename, and the
 * content phase bails if `about-us` already carries a story-timeline-section.
 *
 * Usage:
 *   node scripts/seed-about-redesign.mjs --schema-only   # just the Types
 *   node scripts/seed-about-redesign.mjs                 # schema + media + content
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);
const schemaOnly = process.argv.includes('--schema-only');

nextEnv.loadEnvConfig(repoRoot);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`seed-about-redesign: ${name} is required`);
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

const ACTOR = 'seed:about-redesign';
const PAGE_KEY = 'about-us';

const TIMELINE_TYPE = 'story-timeline-section';
const MILESTONE_TYPE = 'milestone';
const VALUES_TYPE = 'values-section';
const VALUE_TYPE = 'value-item';

// ---------------------------------------------------------------------------
// 1. Schema
// ---------------------------------------------------------------------------

// `body` is `blocks` (JSON), never `richtext`. `richtext` maps to a String
// scalar, which both mis-renders and collides with the other sections' JSON
// `body` inside the GetPage union — same reasoning as seed-split-sections.mjs.
const MILESTONE_FIELDS = [
  // `text`, not `date`: the `date` kind is a strict ISO YYYY-MM-DD string, and
  // a rail label is "2016" or "Spring 2019".
  { __name: 'dateLabel', __type: 'text', label: 'Date label', required: true },
  { __name: 'heading', __type: 'text', label: 'Heading' },
  { __name: 'body', __type: 'blocks', label: 'Body' },
  { __name: 'image', __type: 'asset', accept: 'image', label: 'Image' },
];

const TIMELINE_FIELDS = [
  { __name: 'overline', __type: 'text', label: 'Overline' },
  { __name: 'title', __type: 'text', label: 'Title' },
  {
    __name: 'milestones',
    __type: 'references',
    allowedTypes: [MILESTONE_TYPE],
    label: 'Milestones',
  },
];

const VALUE_FIELDS = [
  { __name: 'label', __type: 'text', label: 'Tab label', required: true },
  { __name: 'body', __type: 'blocks', label: 'Body' },
  { __name: 'image', __type: 'asset', accept: 'image', label: 'Image' },
];

const VALUES_FIELDS = [
  // Rendered as the section's <h2>, wearing overline styling — the heading
  // outline stays intact while the visual stays a small gold eyebrow.
  { __name: 'overline', __type: 'text', label: 'Overline (section heading)' },
  {
    __name: 'values',
    __type: 'references',
    allowedTypes: [VALUE_TYPE],
    label: 'Values',
  },
];

const NEW_TYPES = [
  {
    __name: MILESTONE_TYPE,
    label: 'Milestone',
    description: 'One year in a Story Timeline: date label, heading, body and image.',
    titleField: 'dateLabel',
    fields: MILESTONE_FIELDS,
  },
  {
    __name: TIMELINE_TYPE,
    label: 'Story Timeline',
    description: 'Company history as a full-bleed image with a year rail beneath it.',
    thumbnail: 'storyTimeline',
    titleField: 'title',
    fields: TIMELINE_FIELDS,
  },
  {
    __name: VALUE_TYPE,
    label: 'Value',
    description: 'One tab in a Value tabs section: label, body and image.',
    titleField: 'label',
    fields: VALUE_FIELDS,
  },
  {
    __name: VALUES_TYPE,
    label: 'Value tabs',
    description: 'Values as a tab strip over an image with the copy beside it.',
    thumbnail: 'valueTabs',
    titleField: 'overline',
    fields: VALUES_FIELDS,
  },
];

const schema = await adapter.getSchema();
const version = await adapter.getSchemaVersion();
const nextSchema = JSON.parse(JSON.stringify(schema)); // deep clone; only add
let schemaChanged = false;

for (const type of NEW_TYPES) {
  const idx = nextSchema.findIndex((t) => t.__name === type.__name);
  if (idx === -1) {
    nextSchema.push(type);
    schemaChanged = true;
    console.log(`schema: added Type "${type.__name}"`);
  } else if (JSON.stringify(nextSchema[idx].fields) !== JSON.stringify(type.fields)) {
    // Reconcile fields while keeping the Type-level stamps saveSchema writes.
    nextSchema[idx] = { ...nextSchema[idx], ...type };
    schemaChanged = true;
    console.log(`schema: reconciled Type "${type.__name}" fields`);
  }
}

// prose-section gains a `title` — purely additive, so existing published
// entries keep projecting fine (ADR 0011 read-time projection).
const prose = nextSchema.find((t) => t.__name === 'prose-section');
if (!prose) throw new Error('seed-about-redesign: no "prose-section" Type in schema');
if (!prose.fields.some((f) => f.__name === 'title')) {
  const at = prose.fields.findIndex((f) => f.__name === 'overline');
  prose.fields.splice(at === -1 ? 0 : at + 1, 0, {
    __name: 'title',
    __type: 'text',
    label: 'Title',
  });
  schemaChanged = true;
  console.log('schema: added "title" to prose-section');
}

// Section Types go on `page.sections` only — not blog-post, not project.
const pageType = nextSchema.find((t) => t.__name === 'page');
if (!pageType) throw new Error('seed-about-redesign: no "page" Type in schema');
const sectionsField = pageType.fields.find((f) => f.__name === 'sections');
if (!sectionsField) throw new Error('seed-about-redesign: "page" has no "sections" field');
sectionsField.allowedTypes = sectionsField.allowedTypes ?? [];
for (const t of [TIMELINE_TYPE, VALUES_TYPE]) {
  if (!sectionsField.allowedTypes.includes(t)) {
    sectionsField.allowedTypes.push(t);
    schemaChanged = true;
    console.log(`schema: added "${t}" to page.sections allowedTypes`);
  }
}

if (schemaChanged) {
  await adapter.saveSchema(nextSchema, ACTOR, version);
  console.log('schema: saved.');
} else {
  console.log('schema: already up to date.');
}

if (schemaOnly) {
  console.log('seed-about-redesign: --schema-only, done.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Media
// ---------------------------------------------------------------------------

const IMG_W = 1920;
const IMG_H = 1080;

/**
 * Unsplash photos, free commercial licence, no attribution required and no
 * brand marks in frame. The crop is requested in the URL so the stored width
 * and height are exact without decoding the JPEG.
 */
const PHOTOS = {
  'tiled-bathroom-wall': {
    id: 'photo-1523413651479-597eb2da0ad6',
    alt: 'White metro-tiled bathroom wall with a chrome mixer tap',
  },
  'site-crew-rebar': {
    id: 'photo-1504307651254-35680f356dfd',
    alt: 'Workers in high-visibility clothing on a reinforced concrete site',
  },
  'drawing-house-plans': {
    id: 'photo-1503387762-592deb58ef4e',
    alt: 'A builder drawing house plans by hand with a scale rule',
  },
  'open-plan-living': {
    id: 'photo-1600607687939-ce8a6c25118c',
    alt: 'Open-plan living room and kitchen after a full refurbishment',
  },
  'white-kitchen-marble': {
    id: 'photo-1556911220-bff31c812dba',
    alt: 'White handleless kitchen with a marble worktop and gas hob',
  },
  'house-exterior-dusk': {
    id: 'photo-1600585154340-be6161a56a0c',
    alt: 'Extended house lit from inside at dusk, seen from the garden',
  },
  'bathroom-glass-shower': {
    id: 'photo-1584622650111-993a426fbf0a',
    alt: 'Renovated bathroom with a glass shower enclosure and twin basins',
  },
  'bathroom-freestanding-bath': {
    id: 'photo-1620626011761-996317b8d101',
    alt: 'Bathroom with a freestanding bath and a countertop basin',
  },
  'electrician-junction-box': {
    id: 'photo-1621905251189-08b45d6a269e',
    alt: 'An electrician in a hard hat wiring a junction box',
  },
  'sealing-window-frame': {
    id: 'photo-1607400201515-c2c41c07d307',
    alt: 'A gloved hand running sealant along a new window frame',
  },
  'drawings-and-toolbox': {
    id: 'photo-1581092160562-40aa08e78837',
    alt: 'Technical drawings marked up on a desk beside a toolbox',
  },
};

const existingMedia = await adapter.listMedia();
const mediaByFilename = new Map(existingMedia.map((m) => [m.filename, m.id]));

/** filename (without extension) -> media id */
const mediaIds = {};

for (const [name, photo] of Object.entries(PHOTOS)) {
  const filename = `${name}.jpg`;
  const already = mediaByFilename.get(filename);
  if (already) {
    mediaIds[name] = already;
    console.log(`  = media ${filename}: already uploaded`);
    continue;
  }

  const url = `https://images.unsplash.com/${photo.id}?w=${IMG_W}&h=${IMG_H}&fit=crop&q=72&fm=jpg`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`seed-about-redesign: ${filename} download failed (${resp.status})`);
  const bytes = new Uint8Array(await resp.arrayBuffer());

  const item = await adapter.putMedia(
    bytes,
    {
      filename,
      mime: 'image/jpeg',
      alternativeText: photo.alt,
      width: IMG_W,
      height: IMG_H,
    },
    ACTOR
  );
  mediaIds[name] = item.id;
  console.log(`  + media ${filename}: ${(bytes.length / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------------------
// 3. Content
// ---------------------------------------------------------------------------

const pageRes = await adapter.query('page', {
  where: { key: { eq: PAGE_KEY } },
  page: { limit: 1 },
});
const pageEntry = pageRes.data[0];
if (!pageEntry) throw new Error(`seed-about-redesign: no page with key "${PAGE_KEY}"`);

const existingTimelines = await adapter.query(TIMELINE_TYPE, { page: { limit: 100 } });
const timelineIds = new Set(existingTimelines.data.map((e) => e.__id));
const currentSections = Array.isArray(pageEntry.sections) ? [...pageEntry.sections] : [];
if (currentSections.some((id) => timelineIds.has(id))) {
  console.log('content: /about already carries a Story Timeline — skipping.');
  process.exit(0);
}

/** A blocks paragraph — the shape ZeroCmsBlocks / RichTextViewer render. */
const p = (text) => ({ type: 'paragraph', children: [{ type: 'text', text }] });

/**
 * Filler copy in USC's voice. Dates and accreditations are PLAUSIBLE FILLER,
 * not verified facts — confirm with the client before launch.
 */
const MILESTONES = [
  {
    dateLabel: '2016',
    heading: 'First keys, first job',
    image: 'tiled-bathroom-wall',
    body: [
      p(
        'Upper Street Contractors started with one van, two trades and a full bathroom refit ' +
          'off Roman Way. The brief was simple and it has not changed since: turn up when we say ' +
          'we will, price the job honestly, and leave the place better than we found it.'
      ),
    ],
  },
  {
    dateLabel: '2018',
    heading: 'Trades brought in-house',
    image: 'electrician-junction-box',
    body: [
      p(
        'Chasing subcontractors was costing our clients time, so we stopped. Plumbing and ' +
          'electrics came in-house, which meant one team on site, one programme to keep, and ' +
          'nobody waiting a fortnight for a first fix.'
      ),
    ],
  },
  {
    dateLabel: '2020',
    heading: 'Working through it',
    image: 'drawings-and-toolbox',
    body: [
      p(
        'Lockdown forced a rethink. We moved surveys to video walkarounds, staged handovers so ' +
          'households and trades were never in the same room, and kept every live site running ' +
          'safely. Half of it stuck: remote first looks are still how most quotes begin.'
      ),
    ],
  },
  {
    dateLabel: '2022',
    heading: 'Whole homes, one programme',
    image: 'open-plan-living',
    body: [
      p(
        'Single-room work grew into full-house refurbishments — structural openings, kitchen, ' +
          'bathrooms, joinery and decoration under one programme and one point of contact. ' +
          'Owner-led throughout, because a project this size is where handoffs do the damage.'
      ),
    ],
  },
  {
    dateLabel: '2024',
    heading: 'Accredited and guaranteed',
    image: 'sealing-window-frame',
    body: [
      p(
        'Gas Safe, NICEIC and TrustMark registration formalised what our trades were already ' +
          'doing, and the 12-month workmanship guarantee went into writing on every quote. ' +
          'Detailing is where a renovation ages well or badly, so we made it the thing we sign for.'
      ),
    ],
  },
  {
    dateLabel: '2026',
    heading: 'Ten years on',
    image: 'house-exterior-dusk',
    body: [
      p(
        'A decade across Islington and North London, still family-run and still owner-led. ' +
          'Most of our work now comes from people we built for years ago, or from the neighbour ' +
          'who watched us do it.'
      ),
    ],
  },
];

const VALUES = [
  {
    label: 'Owner-led accountability',
    image: 'site-crew-rebar',
    body: [
      p(
        'The person who quotes your job is the person who runs it. There is no account manager ' +
          'between you and the site, no handover to a team you have never met, and one name to ' +
          'call when something needs a decision. It is the reason we stay deliberately small.'
      ),
    ],
  },
  {
    label: 'Clear, fixed quotes',
    image: 'drawing-house-plans',
    body: [
      p(
        'Every quote is broken down by trade and by stage, priced from a real site visit rather ' +
          'than a phone call. You see what is included, what is provisional and what would ' +
          'change the number — before any work starts, not halfway through.'
      ),
    ],
  },
  {
    label: 'A site you can live with',
    image: 'bathroom-freestanding-bath',
    body: [
      p(
        'Most of our clients stay in the house while we work, so dust protection, a swept floor ' +
          'and a usable bathroom at the end of each day are not extras. We agree working hours up ' +
          'front and we keep to them.'
      ),
    ],
  },
  {
    label: 'Trades who care',
    image: 'white-kitchen-marble',
    body: [
      p(
        'We work with the same tilers, joiners and electricians job after job, because knowing ' +
          'how someone finishes an edge matters more than what they charge. The parts you see ' +
          'and the parts behind the plasterboard get the same attention.'
      ),
    ],
  },
  {
    label: 'Local and lasting',
    image: 'bathroom-glass-shower',
    body: [
      p(
        'We are based in Islington and work across North London, so we are ten minutes away if ' +
          'something needs looking at. Every job carries a 12-month workmanship guarantee, and we ' +
          'would rather come back once than lose a neighbour.'
      ),
    ],
  },
];

const INTRO = {
  overline: 'Who we are',
  title: 'A family-run team that stays on your job',
  body: [
    p(
      'Upper Street Contractors is a family-run, owner-led building team based in Islington, ' +
        'working across North London since 2016. We handle bathroom renovations, kitchen ' +
        'installations and full home refurbishments, along with the smaller repairs and ' +
        'maintenance that keep a house working.'
    ),
    p(
      'We are deliberately small. The same people quote the work, run the programme and stand ' +
        'behind it afterwards — which is what lets us give you a fixed price, a realistic date ' +
        'and a straight answer when something on site turns out differently than expected.'
    ),
  ],
};

/** create + publish in one go; returns the entry id. */
async function add(type, values) {
  const created = await adapter.create(type, values, ACTOR);
  const published = await adapter.publish(type, created.__id, ACTOR, created.__lastEditedAt);
  return published.__id;
}

const milestoneIds = [];
for (const m of MILESTONES) {
  milestoneIds.push(
    await add(MILESTONE_TYPE, {
      dateLabel: m.dateLabel,
      heading: m.heading,
      body: m.body,
      image: mediaIds[m.image],
    })
  );
}
console.log(`content: created ${milestoneIds.length} Milestones`);

const valueIds = [];
for (const v of VALUES) {
  valueIds.push(
    await add(VALUE_TYPE, { label: v.label, body: v.body, image: mediaIds[v.image] })
  );
}
console.log(`content: created ${valueIds.length} Values`);

const introId = await add('prose-section', INTRO);
const timelineId = await add(TIMELINE_TYPE, {
  overline: 'Our story',
  title: 'Ten years of North London renovations',
  milestones: milestoneIds,
});
const valuesId = await add(VALUES_TYPE, { overline: 'Our values', values: valueIds });
console.log('content: created intro, Story Timeline and Value tabs sections');

// --- rewire the page --------------------------------------------------------
// Keep the hero, replace everything under it. The unlinked entries stay in the
// store until scripts/prune-about-orphans.mjs is run.
const heroes = await adapter.query('page-hero', { page: { limit: 200 } });
const heroIds = new Set(heroes.data.map((h) => h.__id));
const keptHero = currentSections.filter((id) => heroIds.has(id));

const nextSections = [...keptHero, introId, timelineId, valuesId];
const dropped = currentSections.filter((id) => !heroIds.has(id));

const patched = await adapter.patch(
  'page',
  pageEntry.__id,
  { sections: nextSections },
  ACTOR,
  pageEntry.__lastEditedAt
);
await adapter.publish('page', pageEntry.__id, ACTOR, patched.__lastEditedAt);

console.log(`page: sections ${currentSections.length} -> ${nextSections.length}`);
console.log(`page: unlinked ${dropped.length} section(s):`);
for (const id of dropped) console.log(`    ${id}`);
console.log('\nseed-about-redesign: done. Run scripts/prune-about-orphans.mjs to delete the unlinked entries.');
