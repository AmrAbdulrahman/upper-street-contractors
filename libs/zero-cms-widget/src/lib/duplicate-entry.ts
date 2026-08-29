import type { Adapter, Schema } from '@usc/zero-cms-core';

/**
 * Deep-copy an Entry and everything it owns.
 *
 * A Blog Post's content **is** its `sections` — an array of Entry ids. Copying
 * only the post's own fields would hand back a second post pointing at the
 * *same* sections, so editing the copy would silently rewrite the original.
 * That is the one outcome a "Duplicate" button must not have, so the copy takes
 * its own sections, and their own children, all the way down.
 *
 * Three things are deliberately **not** copied:
 *
 * - **Media.** An `asset` field holds a media id. The copy points at the same
 *   file, because a second upload of identical bytes is a second thing to
 *   replace when the logo changes.
 * - **Standalone content** (`shareTypes`). Some referenced Entries are not
 *   part of the thing being copied — a Project has its own `/projects/:id`
 *   page, a Button is shared by every CTA band on the site. Copying those
 *   would mint an orphan case study, or quietly detach a button from the
 *   site-wide edit that is supposed to reach it. The caller names those Types;
 *   this module has no opinion about which they are.
 * - **Lifecycle.** Copies are created, never published. A duplicate appears as
 *   an unpublished draft, which is what lets an editor rename it before anyone
 *   can read it.
 *
 * Runs entirely on ops that already exist (`locate`, `get`, `create`) — there
 * is no `duplicate` in the RPC protocol and this deliberately does not add one.
 */

/** The adapter surface a duplicate needs. Narrow, so tests can fake it. */
export type DuplicateAdapter = Pick<Adapter, 'get' | 'create' | 'locate'>;

export interface DuplicateEntryOptions {
  /**
   * Types to share rather than copy. A reference to one of these is carried
   * across unchanged.
   */
  shareTypes?: readonly string[];
  /**
   * Fields blanked on the **root** copy only. A `slug` belongs here: zero-cms
   * enforces no uniqueness, so a copied slug would silently shadow the original
   * (the route takes the first match). Blanked, it re-derives from the title.
   */
  clearFields?: readonly string[];
  /** Field to suffix on the root copy — normally the title. */
  renameField?: string;
  /** What to append to {@link renameField}. */
  renameSuffix?: string;
  /** Hard stop on runaway graphs. */
  maxEntries?: number;
}

export interface DuplicateEntryResult {
  /** The new root Entry's id. */
  id: string;
  /** The new root Entry's Type. */
  type: string;
  /** How many Entries were created, the root included. */
  created: number;
  /**
   * Entries that were re-entered while their own copy was still being built —
   * a reference cycle. Each is shared with the original rather than copied,
   * which is the only way the walk can terminate. Empty for the tree-shaped
   * content this is actually used on.
   */
  cycles: string[];
}

const DEFAULT_MAX_ENTRIES = 500;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export async function duplicateEntry(
  rootId: string,
  deps: { adapter: DuplicateAdapter; schema: Schema; actor: string },
  options: DuplicateEntryOptions = {}
): Promise<DuplicateEntryResult> {
  const { adapter, schema, actor } = deps;
  const {
    shareTypes = [],
    clearFields = [],
    renameField,
    renameSuffix = ' (copy)',
    maxEntries = DEFAULT_MAX_ENTRIES,
  } = options;

  const shared = new Set(shareTypes);
  const typeByName = new Map(schema.map((t) => [t.__name, t]));

  /** old id -> new id, for Entries already copied. Collapses a diamond. */
  const done = new Map<string, string>();
  /** Ids whose copy is still being built — re-entering one is a cycle. */
  const inFlight = new Set<string>();
  const cycles: string[] = [];
  let created = 0;

  async function resolveType(id: string): Promise<string | null> {
    const located = await adapter.locate(id);
    return located?.type ?? null;
  }

  /**
   * Copy one Entry, depth-first, and return the new id — or the ORIGINAL id
   * when the reference should be shared rather than copied (a `shareTypes`
   * member, a missing Entry, or a cycle).
   */
  async function copy(id: string, isRoot: boolean): Promise<string> {
    const existing = done.get(id);
    if (existing) return existing;

    if (inFlight.has(id)) {
      // A -> B -> A. Sharing the original is the only termination that leaves
      // both copies coherent; the alternative is an unbounded walk.
      cycles.push(id);
      return id;
    }

    const type = await resolveType(id);
    if (!type) return id; // dangling reference — carry it across untouched

    if (!isRoot && shared.has(type)) return id;

    if (created >= maxEntries) {
      throw new Error(
        `duplicateEntry: refusing to copy more than ${maxEntries} entries — ` +
          `"${type}" (${id}) would be next. Check for an unexpected reference chain.`
      );
    }

    // Draft, not published: an editor duplicates what they can currently see,
    // and a published-only read would copy a stale version of a post they have
    // unsaved edits on.
    const source = await adapter.get(type, id, {
      status: 'draft',
      includeUnpublished: true,
    });
    if (!source) return id;

    inFlight.add(id);

    const definition = typeByName.get(type);
    const values: Record<string, unknown> = {};

    for (const field of definition?.fields ?? []) {
      const name = field.__name;
      const value = (source as Record<string, unknown>)[name];

      if (isRoot && clearFields.includes(name)) {
        continue; // omitted, not '' — an absent value re-derives, a blank one may not
      }

      if (field.__type === 'reference') {
        values[name] = isNonEmptyString(value) ? await copy(value, false) : value;
        continue;
      }

      if (field.__type === 'references') {
        if (!Array.isArray(value)) {
          values[name] = value;
          continue;
        }

        const next: string[] = [];
        for (const child of value) {
          next.push(isNonEmptyString(child) ? await copy(child, false) : child);
        }
        values[name] = next;
        continue;
      }

      // Everything else by value — including `asset`, which is a media id.
      values[name] = value;
    }

    if (isRoot && renameField) {
      const current = values[renameField];
      values[renameField] = isNonEmptyString(current)
        ? `${current}${renameSuffix}`
        : current;
    }

    const entry = await adapter.create(type, values, actor);
    inFlight.delete(id);
    done.set(id, entry.__id);
    created += 1;

    return entry.__id;
  }

  const rootType = await resolveType(rootId);
  if (!rootType) {
    throw new Error(`duplicateEntry: no entry found for id "${rootId}"`);
  }

  const newId = await copy(rootId, true);

  if (newId === rootId) {
    throw new Error(`duplicateEntry: could not copy "${rootId}" (${rootType})`);
  }

  return { id: newId, type: rootType, created, cycles };
}
