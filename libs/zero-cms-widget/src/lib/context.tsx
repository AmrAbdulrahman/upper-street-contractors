'use client';

/**
 * Widget controller: lets any part of a host app open the in-place edit drawer for
 * an entry by `__id`. The Type is resolved from the id via `adapter.locate` (so the
 * host only needs the id), then the drawer reuses zero-cms-app's EntryEditor.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useZeroCms } from '@usc/zero-cms-app';

export interface OpenOptions {
  /** Skip the `locate` round-trip if the caller already knows the Type. */
  type?: string;
  /** Field `__name` to scroll to + highlight when the drawer opens. */
  focusField?: string;
}

interface DrawerTarget {
  id: string;
  type: string;
  focusField?: string;
}

interface WidgetContextValue {
  /** Inspect mode: when true, <ZeroCmsEntry>/<ZeroCmsEntryField> show edit affordances. */
  inspect: boolean;
  isOpen: boolean;
  openEntry: (id: string, opts?: OpenOptions) => Promise<void>;
  close: () => void;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

/** Internal: also exposes the resolved target + loading/error to the drawer. */
interface WidgetInternal extends WidgetContextValue {
  target: DrawerTarget | null;
  loading: boolean;
  error: string | null;
}
const InternalContext = createContext<WidgetInternal | null>(null);

export function WidgetProvider({
  children,
  inspect = false,
}: {
  children: ReactNode;
  inspect?: boolean;
}) {
  const { adapter } = useZeroCms();
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inspect overlays (<ZeroCmsEntry>/<ZeroCmsEntryField>) clone host elements that
  // cross the RSC server->client boundary; the server sees opaque child references
  // while the client sees real elements, so SSR-ing the overlay markup desyncs and
  // throws a hydration mismatch. Gate inspect on mount so SSR + the first client
  // render are always the plain children, then enable the overlays client-side.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const inspectActive = hydrated && inspect;

  const openEntry = useCallback(
    async (id: string, opts?: OpenOptions) => {
      setError(null);
      if (opts?.type) {
        setTarget({ id, type: opts.type, focusField: opts.focusField });
        return;
      }
      setLoading(true);
      try {
        const found = await adapter.locate(id);
        if (!found) setError(`No entry with id "${id}"`);
        else
          setTarget({
            id: found.id,
            type: found.type,
            focusField: opts?.focusField,
          });
      } catch (err) {
        setError((err as Error)?.message ?? 'Failed to open entry');
      } finally {
        setLoading(false);
      }
    },
    [adapter]
  );

  const close = useCallback(() => {
    setTarget(null);
    setError(null);
  }, []);

  const isOpen = target !== null || loading || error !== null;

  const publicValue = useMemo<WidgetContextValue>(
    () => ({ inspect: inspectActive, isOpen, openEntry, close }),
    [inspectActive, isOpen, openEntry, close]
  );
  const internalValue = useMemo<WidgetInternal>(
    () => ({ ...publicValue, target, loading, error }),
    [publicValue, target, loading, error]
  );

  return (
    <WidgetContext.Provider value={publicValue}>
      <InternalContext.Provider value={internalValue}>
        {children}
      </InternalContext.Provider>
    </WidgetContext.Provider>
  );
}

/** Host-facing hook: trigger the in-place edit drawer from anywhere. */
export function useZeroCmsWidget(): WidgetContextValue {
  const ctx = useContext(WidgetContext);
  if (!ctx)
    throw new Error('useZeroCmsWidget must be used within <ZeroCmsWidget>');
  return ctx;
}

/**
 * Like {@link useZeroCmsWidget} but returns null instead of throwing when there is
 * no <ZeroCmsWidget> — so <ZeroCmsEntry>/<ZeroCmsEntryField> render their children
 * unchanged on public pages where no editing is mounted.
 */
export function useZeroCmsWidgetOptional(): WidgetContextValue | null {
  return useContext(WidgetContext);
}

export function useWidgetInternal(): WidgetInternal {
  const ctx = useContext(InternalContext);
  if (!ctx) throw new Error('widget internals unavailable');
  return ctx;
}
