/**
 * Delete entries that nothing points at any more, starting from a named set of
 * roots — the sections scripts/seed-about-redesign.mjs unlinked from /about.
 *
 * Deliberately NOT a general orphan scanner. Reachability across this store has
 * to account for Types that are read by direct query rather than held by a
 * parent, and getting that wrong deletes live content. Instead this script
 * takes explicit roots and lets the Engine be the authority on what is safe:
 *
 *   - NOTHING is force-deleted, roots included. `force` exists to unlink an
 *     entry from every holder before removing it (ADR 0023), which is precisely
 *     the wrong behaviour here — sections are shared between pages. The Who We
 *     Are and What We Do sections that were on /about are the same entries the
 *     home page renders, and force-deleting them would have silently stripped
 *     two sections off the home page. Without force they fail
 *     REFERENCE_INTEGRITY and are reported as still held.
 *   - Parents go before children, so by the time a child is tried, the only
 *     reference that mattered is already gone. A child something else still
 *     holds — a shared Button, a reused Icon — survives the same way.
 *
 * WRITES TO THE SHARED LIVE STORE (ADR 0008) and the deletion is permanent.
 * Dry run by default: nothing is written without `--yes`.
 *
 * Usage:
 *   node scripts/prune-about-orphans.mjs --ids a,b,c          # plan only
 *   node scripts/prune-about-orphans.mjs --ids a,b,c --yes    # delete
 */

import { createJiti } from 'jiti';
import nextEnv from '@next/env';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => resolve(repoRoot, p);

nextEnv.loadEnvConfig(repoRoot);

const args = process.argv.slice(2);
const apply = args.includes('--yes');
const idsArg = args.find((a) => a.startsWith('--ids='))
  ?? (args.includes('--ids') ? args[args.indexOf('--ids') + 1] : undefined);

const ROOT_IDS = String(idsArg ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (ROOT_IDS.length === 0) {
  console.error('prune-about-orphans: --ids <comma-separated entry ids> is required');
  process.exit(1);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`prune-about-orphans: ${name} is required`);
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

const ACTOR = 'seed:prune-about-orphans';

// --- reference fields, per Type ---------------------------------------------
const schema = await adapter.getSchema();
const refFieldsByType = new Map(
  schema.map((t) => [
    t.__name,
    t.fields
      .filter((f) => f.__type === 'reference' || f.__type === 'references')
      .map((f) => f.__name),
  ])
);

/**
 * Read an entry with its draft visible. A query defaults to published, which
 * would hide an unpublished child and leave it behind as a true orphan.
 */
async function read(type, id) {
  return adapter.get(type, id, { status: 'draft', includeUnpublished: true });
}

function childIdsOf(type, entry) {
  const out = [];
  for (const field of refFieldsByType.get(type) ?? []) {
    const value = entry.values?.[field] ?? entry[field];
    if (Array.isArray(value)) out.push(...value.filter((v) => typeof v === 'string'));
    else if (typeof value === 'string') out.push(value);
  }
  return out;
}

// --- walk the subtree, breadth-first (parents before children) --------------
/** @type {{ id: string, type: string, depth: number, lastEditedAt: string }[]} */
const plan = [];
const seen = new Set();
let frontier = ROOT_IDS.map((id) => ({ id, depth: 0 }));

while (frontier.length > 0) {
  const next = [];
  for (const { id, depth } of frontier) {
    if (seen.has(id)) continue;
    seen.add(id);

    const located = await adapter.locate(id);
    if (!located) {
      console.warn(`  ? ${id}: not found — already deleted?`);
      continue;
    }

    const entry = await read(located.type, id);
    if (!entry) {
      console.warn(`  ? ${id}: located as "${located.type}" but unreadable — skipping`);
      continue;
    }

    plan.push({
      id,
      type: located.type,
      depth,
      lastEditedAt: entry.__lastEditedAt,
    });
    for (const child of childIdsOf(located.type, entry)) {
      next.push({ id: child, depth: depth + 1 });
    }
  }
  frontier = next;
}

console.log(`\nplan: ${plan.length} entr${plan.length === 1 ? 'y' : 'ies'}, parents first\n`);
for (const item of plan) {
  console.log(`  ${'  '.repeat(item.depth)}${item.type}  ${item.id}`);
}
console.log('\nEvery delete is unforced — anything another page still holds survives.');

if (!apply) {
  console.log('\nprune-about-orphans: DRY RUN — nothing written. Re-run with --yes to delete.');
  process.exit(0);
}

// --- delete ------------------------------------------------------------------
let deleted = 0;
let kept = 0;

for (const item of plan) {
  try {
    // Never force — see the header. A still-held entry must be refused, not
    // unlinked from whoever is still using it.
    await adapter.delete(item.type, item.id, ACTOR, item.lastEditedAt, false);
    deleted += 1;
    console.log(`  - deleted ${item.type} ${item.id}`);
  } catch (error) {
    const code = error?.code ?? error?.name;
    if (code === 'REFERENCE_INTEGRITY') {
      kept += 1;
      console.log(`  = kept ${item.type} ${item.id} — still held elsewhere`);
      continue;
    }
    throw error;
  }
}

console.log(`\nprune-about-orphans: deleted ${deleted}, kept ${kept}.`);
