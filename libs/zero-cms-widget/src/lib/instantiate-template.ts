import type { Schema } from '@usc/zero-cms-core';
import { createCopier, isNonEmptyString, type DuplicateAdapter } from './copy-subtree';

/**
 * Create a new Entry of one Type out of the children of an Entry of another.
 *
 * This is what a Template does, in both directions:
 *
 * - **Using** a Template: source is a `template`, target is a `blog-post` /
 *   `page` / `project`. Its `sections` (or, for a project kind, its four owned
 *   child lists) are deep-copied onto a brand new entry.
 * - **Saving** one: source is the real Blog Post / page / Project, target is a
 *   `template`. Same walk, arguments swapped.
 *
 * It is deliberately **not** `duplicateEntry` with a rename. A duplicate's root
 * is a copy of the source's root; here the root is a *different Type* that the
 * source never was, so there is no root to copy — only lists to move across and
 * a `seedValues` bag for the fields the caller supplies (a name, a kind, a
 * title). The children are copied by exactly the same rules as a duplicate,
 * which is why both share {@link createCopier}.
 *
 * `fieldMap` and `shareTypes` are parameters rather than heuristics for the
 * reason ADR 0017 gives: which Types are owned and which are standalone is a
 * fact about *this* content model, and the library has no way to know it.
 */

export interface InstantiateFromOptions {
  /** The Type to create. */
  targetType: string;
  /**
   * Which of the source's list fields land where on the target — source field
   * name to target field name. A template's `sections` maps to a Blog Post's
   * `sections`; a project template's four child lists map to their namesakes.
   * A source field that is absent or empty is simply not set on the target.
   */
  fieldMap: Record<string, string>;
  /**
   * Field values written straight onto the new Entry — a Template's `name` and
   * `kind`, or a target's `title`. These win over anything `fieldMap` produced.
   */
  seedValues?: Record<string, unknown>;
  /** Types shared rather than copied — see {@link createCopier}. */
  shareTypes?: readonly string[];
  /** Hard stop on runaway graphs. */
  maxEntries?: number;
}

export interface InstantiateFromResult {
  /** The new Entry's id. */
  id: string;
  /** The new Entry's Type — the `targetType` that was asked for. */
  type: string;
  /** How many Entries were created, the new root included. */
  created: number;
  /** Reference cycles closed by sharing the original. See {@link createCopier}. */
  cycles: string[];
}

export async function instantiateFrom(
  sourceId: string,
  deps: { adapter: DuplicateAdapter; schema: Schema; actor: string },
  options: InstantiateFromOptions
): Promise<InstantiateFromResult> {
  const { adapter, schema, actor } = deps;
  const { targetType, fieldMap, seedValues = {}, shareTypes, maxEntries } = options;

  if (!schema.some((t) => t.__name === targetType)) {
    throw new Error(`instantiateFrom: no "${targetType}" Type in the schema`);
  }

  const copier = createCopier(deps, { shareTypes, maxEntries });

  const sourceType = await copier.resolveType(sourceId);
  if (!sourceType) {
    throw new Error(`instantiateFrom: no entry found for id "${sourceId}"`);
  }

  // Draft, so an editor gets the shape they can currently see rather than the
  // last published one.
  const source = await adapter.get(sourceType, sourceId, {
    status: 'draft',
    includeUnpublished: true,
  });
  if (!source) {
    throw new Error(`instantiateFrom: could not read "${sourceId}" (${sourceType})`);
  }

  const values: Record<string, unknown> = {};

  for (const [from, to] of Object.entries(fieldMap)) {
    const value = (source as Record<string, unknown>)[from];

    if (Array.isArray(value)) {
      if (value.length > 0) values[to] = await copier.copyList(value);
      continue;
    }

    if (isNonEmptyString(value)) {
      values[to] = await copier.copy(value);
    }
  }

  // Seeded values last: a caller-supplied title is never a copied one.
  const entry = await adapter.create(targetType, { ...values, ...seedValues }, actor);

  return {
    id: entry.__id,
    type: targetType,
    created: copier.created + 1,
    cycles: [...copier.cycles],
  };
}
