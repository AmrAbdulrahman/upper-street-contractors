/**
 * Runtime Store: the typed per-Type facade the generated client exposes. It only
 * delegates to the injected {@link Adapter} — all logic lives in the Engine, so
 * the same Store works over fs (node) or http (browser).
 *
 * `TInput` = writeable values; `TEntry` = the flat output entry (ids for refs).
 *
 * Every mutating method takes `actor` (caller identity, required — ADR 0009) and,
 * for anything acting on an existing entry, `expectedLastEditedAt` — the value
 * last read for that entry (`entry.__lastEditedAt` on whatever `get`/`query`
 * returned). A mismatch throws `ZeroCmsError('CONFLICT', ...)`.
 */

import type { EntryValues } from '../model/entry';
import type { GetOptions, QueryInput, QueryResult } from '../model/query';
import type { Adapter, DanglingRef } from '../adapter/adapter';

// `TInput` is the generated `*Input` interface. Interfaces have no implicit index
// signature, so it is left unconstrained (not `extends EntryValues`) and cast at the
// adapter boundary.
export interface Store<TInput, TEntry> {
  create(values: TInput, actor: string): Promise<TEntry>;
  update(id: string, values: TInput, actor: string, expectedLastEditedAt: string): Promise<TEntry>;
  patch(
    id: string,
    partial: Partial<TInput>,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<TEntry>;
  delete(id: string, actor: string, expectedLastEditedAt: string): Promise<void>;
  publish(id: string, actor: string, expectedLastEditedAt: string): Promise<TEntry>;
  unpublish(id: string, actor: string, expectedLastEditedAt: string): Promise<TEntry>;
  discardDraft(id: string, actor: string, expectedLastEditedAt: string): Promise<TEntry>;
  get(id: string, opts?: GetOptions): Promise<TEntry | null>;
  list(input?: QueryInput): Promise<QueryResult<TEntry>>;
  query(input?: QueryInput): Promise<QueryResult<TEntry>>;
  validateRefs(id: string): Promise<DanglingRef[]>;
}

export function bindStore<TInput, TEntry>(
  adapter: Adapter,
  typeName: string
): Store<TInput, TEntry> {
  const asValues = (v: unknown) => v as EntryValues;
  return {
    create: (values, actor) =>
      adapter.create(typeName, asValues(values), actor) as Promise<TEntry>,
    update: (id, values, actor, expected) =>
      adapter.update(typeName, id, asValues(values), actor, expected) as Promise<TEntry>,
    patch: (id, partial, actor, expected) =>
      adapter.patch(typeName, id, asValues(partial), actor, expected) as Promise<TEntry>,
    delete: (id, actor, expected) => adapter.delete(typeName, id, actor, expected),
    publish: (id, actor, expected) =>
      adapter.publish(typeName, id, actor, expected) as Promise<TEntry>,
    unpublish: (id, actor, expected) =>
      adapter.unpublish(typeName, id, actor, expected) as Promise<TEntry>,
    discardDraft: (id, actor, expected) =>
      adapter.discardDraft(typeName, id, actor, expected) as Promise<TEntry>,
    get: (id, opts) => adapter.get(typeName, id, opts) as Promise<TEntry | null>,
    list: (input) => adapter.query(typeName, input) as Promise<QueryResult<TEntry>>,
    query: (input) => adapter.query(typeName, input) as Promise<QueryResult<TEntry>>,
    validateRefs: (id) => adapter.validateRefs(typeName, id),
  };
}
