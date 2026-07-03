'use client';

/**
 * Draft registry — a tiny in-memory store of the entries that currently carry an
 * unpublished draft, keyed by `type:id`. It is deliberately dumb: it does no
 * querying itself. Two producers keep it truthful:
 *
 *  - the {@link EntryEditor} optimistically {@link DraftRegistryValue.markDraft}s on
 *    every save/autosave and {@link DraftRegistryValue.clearDraft}s on
 *    publish/discard/delete, so the count reacts instantly to edits; and
 *  - the {@link ZeroCmsBar} calls {@link DraftRegistryValue.setDrafts} with an
 *    authoritative `hasDraft` query on open / after publishing, so it self-heals.
 *
 * The bar reads {@link DraftRegistryValue.drafts} to render its 3-state publish
 * button. Mounted inside {@link ZeroCmsProvider} so both /admin and the in-place
 * widget share one store.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface DraftRef {
  type: string;
  id: string;
}

const keyOf = (type: string, id: string) => `${type}:${id}`;

export interface DraftRegistryValue {
  /** Every entry known to have a pending draft, in insertion order. */
  drafts: DraftRef[];
  /** Note an entry now has a draft (no-op if already tracked). */
  markDraft: (type: string, id: string) => void;
  /** Forget an entry's draft (published / discarded / deleted). */
  clearDraft: (type: string, id: string) => void;
  /** Replace the whole set from an authoritative query. */
  setDrafts: (refs: DraftRef[]) => void;
}

const Ctx = createContext<DraftRegistryValue | null>(null);

export function DraftRegistryProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Map<string, DraftRef>>(() => new Map());

  const markDraft = useCallback((type: string, id: string) => {
    setMap((prev) => {
      const k = keyOf(type, id);
      if (prev.has(k)) return prev;
      const next = new Map(prev);
      next.set(k, { type, id });
      return next;
    });
  }, []);

  const clearDraft = useCallback((type: string, id: string) => {
    setMap((prev) => {
      const k = keyOf(type, id);
      if (!prev.has(k)) return prev;
      const next = new Map(prev);
      next.delete(k);
      return next;
    });
  }, []);

  const setDrafts = useCallback((refs: DraftRef[]) => {
    setMap(new Map(refs.map((r) => [keyOf(r.type, r.id), r])));
  }, []);

  const drafts = useMemo(() => Array.from(map.values()), [map]);
  const value = useMemo<DraftRegistryValue>(
    () => ({ drafts, markDraft, clearDraft, setDrafts }),
    [drafts, markDraft, clearDraft, setDrafts]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDraftRegistry(): DraftRegistryValue {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error('useDraftRegistry must be used within a DraftRegistryProvider');
  return ctx;
}

/** Non-throwing variant for surfaces that may render without the provider. */
export function useDraftRegistryOptional(): DraftRegistryValue | null {
  return useContext(Ctx);
}
