/**
 * Runtime Store: the typed per-Type facade the generated client exposes. It only
 * delegates to the injected {@link Adapter} — all logic lives in the Engine, so
 * the same Store works over fs (node) or http (browser).
 *
 * `TInput` = writeable values; `TEntry` = the flat output entry (ids for refs).
 */

import type { EntryValues } from '../model/entry';
import type { GetOptions, QueryInput, QueryResult } from '../model/query';
import type { Adapter, DanglingRef } from '../adapter/adapter';

// `TInput` is the generated `*Input` interface. Interfaces have no implicit index
// signature, so it is left unconstrained (not `extends EntryValues`) and cast at the
// adapter boundary.
export interface Store<TInput, TEntry> {
  create(values: TInput): Promise<TEntry>;
  update(id: string, values: TInput): Promise<TEntry>;
  patch(id: string, partial: Partial<TInput>): Promise<TEntry>;
  delete(id: string): Promise<void>;
  publish(id: string): Promise<TEntry>;
  unpublish(id: string): Promise<TEntry>;
  discardDraft(id: string): Promise<TEntry>;
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
    create: (values) => adapter.create(typeName, asValues(values)) as Promise<TEntry>,
    update: (id, values) =>
      adapter.update(typeName, id, asValues(values)) as Promise<TEntry>,
    patch: (id, partial) =>
      adapter.patch(typeName, id, asValues(partial)) as Promise<TEntry>,
    delete: (id) => adapter.delete(typeName, id),
    publish: (id) => adapter.publish(typeName, id) as Promise<TEntry>,
    unpublish: (id) => adapter.unpublish(typeName, id) as Promise<TEntry>,
    discardDraft: (id) => adapter.discardDraft(typeName, id) as Promise<TEntry>,
    get: (id, opts) => adapter.get(typeName, id, opts) as Promise<TEntry | null>,
    list: (input) => adapter.query(typeName, input) as Promise<QueryResult<TEntry>>,
    query: (input) => adapter.query(typeName, input) as Promise<QueryResult<TEntry>>,
    validateRefs: (id) => adapter.validateRefs(typeName, id),
  };
}
