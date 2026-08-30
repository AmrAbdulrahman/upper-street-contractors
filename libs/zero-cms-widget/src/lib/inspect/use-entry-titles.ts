'use client';

/**
 * Entry titles for the Section builder, fetched lazily.
 *
 * A section slot knows only its child's id and Type — the host rendered the
 * section itself, so the widget never holds the child's values, and a title has
 * to be read. Doing that on every inspect page load would fire one request per
 * section on every CMS-driven page, for a label most visits never look at. So
 * it is deferred to the two moments a name actually matters: the Reorder outline
 * opening (`enabled`), and the remove-confirm dialog opening (`ensure`).
 *
 * Cached per adapter, like `useEntryOptions` — a page dragged twice fetches
 * once, and the remove dialog reuses whatever a prior drag already read.
 */

import { useCallback, useEffect, useState } from 'react';
import { useZeroCmsOptional } from '@usc/zero-cms-app';
import { entryTitle, type Adapter, type OutputEntry } from '@usc/zero-cms-core';

export interface EntryTitleRef {
  id: string;
  type: string | null;
}

const entryCache = new WeakMap<Adapter, Map<string, OutputEntry>>();

function cacheFor(adapter: Adapter): Map<string, OutputEntry> {
  let m = entryCache.get(adapter);
  if (!m) {
    m = new Map();
    entryCache.set(adapter, m);
  }
  return m;
}

const EMPTY = new Map<string, OutputEntry>();

export interface EntryTitles {
  /** Titles by entry id, for the ids that have been read. */
  titles: ReadonlyMap<string, string>;
  /** Read one entry now — for the remove dialog, which opens on a click. */
  ensure: (ref: EntryTitleRef) => Promise<string | undefined>;
}

export function useEntryTitles(
  refs: EntryTitleRef[],
  enabled: boolean,
): EntryTitles {
  const zeroCms = useZeroCmsOptional();
  const adapter = zeroCms?.adapter;
  const cache = adapter ? cacheFor(adapter) : EMPTY;
  // A landed fetch is the only thing that changes the cache, and the cache is a
  // mutable Map React cannot observe — so this is the re-render signal. The
  // titles themselves are read from the cache during render, which is what lets
  // a warm cache (an earlier drag on this page, another mount sharing the
  // adapter) show immediately, with no effect and no state to sync.
  const [fetchedAt, setFetchedAt] = useState(0);
  const key = refs.map((r) => `${r.type ?? ''}:${r.id}`).join(',');

  const read = useCallback(
    async (ref: EntryTitleRef): Promise<OutputEntry | undefined> => {
      if (!adapter || !ref.type || !ref.id) return undefined;
      const hit = cache.get(ref.id);
      if (hit) return hit;
      const entry = await adapter
        .get(ref.type, ref.id, { status: 'draft', includeUnpublished: true })
        .catch(() => null);
      if (entry) cache.set(ref.id, entry);
      return entry ?? undefined;
    },
    [adapter, cache],
  );

  useEffect(() => {
    if (!enabled || !adapter) return;
    const missing = refs.filter((r) => r.type && !cache.has(r.id));
    if (missing.length === 0) return;
    let live = true;
    void Promise.all(missing.map(read)).then(() => {
      if (live) setFetchedAt(Date.now());
    });
    return () => {
      live = false;
    };
    // `refs` is a fresh array every render; `key` is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, adapter, read]);

  const name = (entry: OutputEntry) =>
    entryTitle(
      zeroCms?.schema.find((t) => t.__name === entry.__type),
      entry,
      zeroCms?.media,
    );

  void fetchedAt; // the re-render signal; the titles below come from the cache

  const titles = new Map<string, string>();
  for (const ref of refs) {
    const entry = cache.get(ref.id);
    if (entry) titles.set(ref.id, name(entry));
  }

  const ensure = useCallback(
    async (ref: EntryTitleRef) => {
      const entry = await read(ref);
      if (!entry) return undefined;
      setFetchedAt(Date.now());
      return entryTitle(
        zeroCms?.schema.find((t) => t.__name === entry.__type),
        entry,
        zeroCms?.media,
      );
    },
    [read, zeroCms?.schema, zeroCms?.media],
  );

  return { titles, ensure };
}
