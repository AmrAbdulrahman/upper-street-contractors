'use client';

/**
 * Resolve the schema definition of a parent's relation field — `allowedTypes`,
 * `min`, `max` — plus the parent's own Type `__name`.
 *
 * Inspect-only: this is editor UI, never needed on a public page, so it is
 * gated on `enabled` and returns inert defaults when off.
 *
 * The parent Type is not carried in public GraphQL fragments for every host
 * (they select only ids + values), so it falls back to one `locate` per entry,
 * cached per session. Shared by <ZeroCmsList> and <ZeroCmsSectionList> so the
 * two can't drift.
 */

import { useEffect, useState } from 'react';
import { useZeroCmsOptional } from '@usc/zero-cms-app';
import { useZeroCmsEntry } from './entry-context';

const typeCache = new Map<string, string>();

export interface ReferencesMeta {
  /** Parent Type `__name`, once resolved (null while a `locate` is in flight). */
  parentType: string | null;
  /** Types the field accepts; empty when the field isn't a relation. */
  allowedTypes: string[];
  /** Minimum linked entries; removal below this is blocked. */
  min?: number;
  /** Maximum linked entries; "add" is disabled at this count. */
  max?: number;
  /** False until the field definition has actually been looked up. */
  resolved: boolean;
}

const INERT: ReferencesMeta = {
  parentType: null,
  allowedTypes: [],
  min: undefined,
  max: undefined,
  resolved: false,
};

export function useReferencesMeta(field: string, enabled: boolean): ReferencesMeta {
  const ctx = useZeroCmsEntry();
  const zeroCms = useZeroCmsOptional();
  const entryId = ctx?.entryId;
  const ctxType = ctx?.typeName;

  const [meta, setMeta] = useState<ReferencesMeta>(INERT);

  useEffect(() => {
    if (!enabled || !zeroCms || !entryId || !field) {
      setMeta(INERT);
      return;
    }
    let live = true;
    void (async () => {
      let pType = ctxType ?? typeCache.get(entryId) ?? null;
      if (!pType) {
        pType = (await zeroCms.adapter.locate(entryId))?.type ?? null;
        if (pType) typeCache.set(entryId, pType);
      }
      const def = zeroCms.schema
        .find((t) => t.__name === pType)
        ?.fields.find((f) => f.__name === field);
      if (!live) return;
      setMeta({
        parentType: pType,
        allowedTypes:
          def && (def.__type === 'reference' || def.__type === 'references')
            ? def.allowedTypes
            : [],
        min: def?.__type === 'references' ? def.min : undefined,
        max: def?.__type === 'references' ? def.max : undefined,
        resolved: true,
      });
    })();
    return () => {
      live = false;
    };
  }, [enabled, zeroCms, entryId, ctxType, field]);

  return meta;
}
