'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Adapter } from '@usc/zero-cms-core';
import { useZeroCms } from '../../context';
import type { RefOption } from '../../components/reference-picker';
import { entryLabel } from '../entry-label';

/**
 * Per-adapter cache of a Type's entry options, shared by every `reference`/
 * `references` field across the whole app. Without this, opening any entry
 * re-fetches every one of its relation fields' option lists from scratch —
 * `EntryEditor` fully remounts per entry (by design, ADR: fresh local edit
 * state per entry), so this hook used to re-run on every single switch. Types
 * like `button`/`banner`/`icon`/`cta` are referenced by many entries, so most
 * of those re-fetches were for data already fetched moments earlier — the
 * accumulated round-trips to live Redis (not a local fs store any more) is
 * exactly what read as "the whole page reloads" switching between entries.
 * Keyed by adapter identity, not a module singleton, so distinct
 * ZeroCmsProvider instances (tests, multiple mounts) don't cross-contaminate.
 */
const typeOptionsCache = new WeakMap<Adapter, Map<string, RefOption[]>>();

function cacheFor(adapter: Adapter): Map<string, RefOption[]> {
  let m = typeOptionsCache.get(adapter);
  if (!m) {
    m = new Map();
    typeOptionsCache.set(adapter, m);
  }
  return m;
}

/**
 * Load entries of the allowed target types as picker options. Each option carries
 * its target Type (`type`, for click-to-edit + grouping), the target entry's image
 * (`mediaId`) when its Type has an `asset` field, and `visual` reports whether any
 * allowed Type is image-bearing — so the renderer can switch from a plain dropdown
 * to a thumbnail picker. `reload` invalidates this hook's types in the shared cache
 * and re-queries (call after creating a new entry so it appears in the options and
 * its label resolves).
 */
export function useEntryOptions(allowedTypes: string[]): {
  options: RefOption[];
  visual: boolean;
  reload: () => void;
} {
  const { adapter, schema } = useZeroCms();
  const cache = cacheFor(adapter);
  // Bumped after a fetch resolves (to re-render off the now-populated cache) and
  // by `reload()` (also re-arms the effect below to actually re-fetch).
  const [version, setVersion] = useState(0);
  const key = allowedTypes.join(',');

  const reload = useCallback(() => {
    for (const tn of allowedTypes) cache.delete(tn);
    setVersion((v) => v + 1);
  }, [allowedTypes, cache]);

  useEffect(() => {
    let live = true;
    const missing = allowedTypes.filter((tn) => !cache.has(tn));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map(async (tn) => {
        const type = schema.find((t) => t.__name === tn);
        const assetField = type?.fields.find((f) => f.__type === 'asset')?.__name ?? null;
        const { data } = await adapter.query(tn, {
          status: 'draft',
          includeUnpublished: true,
        });
        cache.set(
          tn,
          data.map((e) => ({
            id: e.__id,
            label: entryLabel(type, e),
            type: tn,
            mediaId: assetField ? ((e[assetField] as string) || null) : null,
          }))
        );
      })
    ).then(() => {
      if (live) setVersion((v) => v + 1);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, adapter, schema, version]);

  const options = allowedTypes.flatMap((tn) => cache.get(tn) ?? []);
  const visual = allowedTypes.some((tn) =>
    schema.find((t) => t.__name === tn)?.fields.some((f) => f.__type === 'asset')
  );

  return { options, visual, reload };
}
