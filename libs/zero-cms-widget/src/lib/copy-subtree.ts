import type { Adapter, Schema } from '@usc/zero-cms-core';

/**
 * The depth-first copier shared by every "make me a new one of these" action.
 *
 * Split out of `duplicateEntry` when Templates arrived. Duplicate copies an
 * Entry onto a new Entry of the *same* Type; instantiating a Template copies a
 * Template's children onto a new Entry of a *different* Type; "Save as
 * template" does the same walk in the other direction. All three want the
 * identical traversal — depth-first through `reference` / `references`, sharing
 * the Types the caller names, collapsing diamonds, terminating cycles — and
 * differ only in what they do with the root.
 *
 * So the root is not this module's business. A copier copies *children*;
 * `duplicateEntry` is the one caller that also runs the root through it.
 */

/** The adapter surface a copy needs. Narrow, so tests can fake it. */
export type DuplicateAdapter = Pick<Adapter, 'get' | 'create' | 'locate'>;

export interface CopierDeps {
  adapter: DuplicateAdapter;
  schema: Schema;
  actor: string;
}

export interface CopierOptions {
  /**
   * Types to share rather than copy. A reference to one of these is carried
   * across unchanged.
   */
  shareTypes?: readonly string[];
  /** Hard stop on runaway graphs. */
  maxEntries?: number;
}

export interface CopyRootOptions {
  /**
   * Treat this id as the root: `shareTypes` does not apply to it, and
   * `clearFields` / `renameField` do.
   */
  isRoot?: boolean;
  /**
   * Fields blanked on the root only. A `slug` belongs here: zero-cms enforces
   * no uniqueness, so a copied slug would silently shadow the original (the
   * route takes the first match). Blanked, it re-derives from the title.
   */
  clearFields?: readonly string[];
  /** Field to suffix on the root — normally the title. */
  renameField?: string;
  /** What to append to {@link renameField}. */
  renameSuffix?: string;
}

export interface Copier {
  /** Copy one Entry and everything it owns; returns the new id. */
  copy(id: string, options?: CopyRootOptions): Promise<string>;
  /** Copy every id in a list, in order. */
  copyList(ids: readonly unknown[]): Promise<unknown[]>;
  /** Resolve an Entry's Type without copying it. */
  resolveType(id: string): Promise<string | null>;
  /** How many Entries have been created so far. */
  readonly created: number;
  /**
   * Entries re-entered while their own copy was still being built — a reference
   * cycle. Each is shared with the original rather than copied, which is the
   * only way the walk can terminate. Empty for tree-shaped content.
   */
  readonly cycles: readonly string[];
}

export const DEFAULT_MAX_ENTRIES = 500;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function createCopier(deps: CopierDeps, options: CopierOptions = {}): Copier {
  const { adapter, schema, actor } = deps;
  const { shareTypes = [], maxEntries = DEFAULT_MAX_ENTRIES } = options;

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
  async function copy(id: string, rootOptions: CopyRootOptions = {}): Promise<string> {
    const {
      isRoot = false,
      clearFields = [],
      renameField,
      renameSuffix = ' (copy)',
    } = rootOptions;

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
        `copySubtree: refusing to copy more than ${maxEntries} entries — ` +
          `"${type}" (${id}) would be next. Check for an unexpected reference chain.`
      );
    }

    // Draft, not published: an editor copies what they can currently see, and a
    // published-only read would take a stale version of something they have
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
        values[name] = isNonEmptyString(value) ? await copy(value) : value;
        continue;
      }

      if (field.__type === 'references') {
        if (!Array.isArray(value)) {
          values[name] = value;
          continue;
        }

        values[name] = await copyList(value);
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

  async function copyList(ids: readonly unknown[]): Promise<unknown[]> {
    const next: unknown[] = [];
    for (const child of ids) {
      next.push(isNonEmptyString(child) ? await copy(child) : child);
    }
    return next;
  }

  return {
    copy,
    copyList,
    resolveType,
    get created() {
      return created;
    },
    get cycles() {
      return cycles;
    },
  };
}
