'use client';

import { useEffect, useState } from 'react';
import { useZeroCms } from '../../context';
import type { RefOption } from '../../components/reference-picker';
import { entryLabel } from '../entry-label';

/**
 * Load entries of the allowed target types as picker options. Each option also
 * carries the target entry's image (`mediaId`) when its Type has an `asset` field,
 * and `visual` reports whether any allowed Type is image-bearing — so the renderer
 * can switch from a plain dropdown to a thumbnail picker.
 */
export function useEntryOptions(allowedTypes: string[]): {
  options: RefOption[];
  visual: boolean;
} {
  const { adapter, schema } = useZeroCms();
  const [options, setOptions] = useState<RefOption[]>([]);
  const [visual, setVisual] = useState(false);
  const key = allowedTypes.join(',');
  useEffect(() => {
    let live = true;
    void (async () => {
      const all: RefOption[] = [];
      let anyImage = false;
      for (const tn of allowedTypes) {
        const type = schema.find((t) => t.__name === tn);
        const assetField = type?.fields.find((f) => f.__type === 'asset')?.__name ?? null;
        if (assetField) anyImage = true;
        const { data } = await adapter.query(tn, {
          status: 'draft',
          includeUnpublished: true,
        });
        for (const e of data)
          all.push({
            id: e.__id,
            label: entryLabel(type, e),
            mediaId: assetField ? ((e[assetField] as string) || null) : null,
          });
      }
      if (live) {
        setOptions(all);
        setVisual(anyImage);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, adapter, schema]);
  return { options, visual };
}
