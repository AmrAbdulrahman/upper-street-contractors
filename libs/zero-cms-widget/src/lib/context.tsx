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
import { useZeroCms, errorMessage } from '@usc/zero-cms-app';

export interface OpenOptions {
  /** Skip the `locate` round-trip if the caller already knows the Type. */
  type?: string;
  /** Field `__name` to scroll to + highlight when the drawer opens. */
  focusField?: string;
}

export interface CreateOptions {
  /** The parent entry to link the new entry into. */
  parentId: string;
  /** Parent Type `__name`; resolved via `locate` when omitted. */
  parentType?: string | null;
  /** The parent's `reference`/`references` field to link into. */
  parentField: string;
}

export interface UnlinkOptions {
  /** The parent entry to unlink the child from. */
  parentId: string;
  /** Parent Type `__name`; resolved via `locate` when omitted. */
  parentType?: string | null;
  /** The parent's `reference`/`references` field to drop the child from. */
  parentField: string;
  /** The child entry id to remove from the field. The entry itself is NOT deleted. */
  childId: string;
}

interface DrawerTarget {
  id: string;
  type: string;
  focusField?: string;
  /** Whether the drawer was opened to create a new entry vs edit an existing one. */
  mode?: 'create' | 'edit';
}

interface WidgetContextValue {
  /** Inspect mode: when true, <ZeroCmsEntry>/<ZeroCmsEntryField> show edit affordances. */
  inspect: boolean;
  isOpen: boolean;
  openEntry: (id: string, opts?: OpenOptions) => Promise<void>;
  /** Create a new entry for a parent relation field, link it, and open its drawer. */
  openCreate: (opts: CreateOptions) => Promise<void>;
  /** Remove a child from a parent relation field (unlink only; entry survives). */
  unlink: (opts: UnlinkOptions) => Promise<void>;
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
  onChanged,
}: {
  children: ReactNode;
  inspect?: boolean;
  /** Called after a mutation the widget performs itself (e.g. unlink) so the host can revalidate. */
  onChanged?: () => void;
}) {
  const { adapter, schema, notify } = useZeroCms();
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
        setTarget({ id, type: opts.type, focusField: opts.focusField, mode: 'edit' });
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
            mode: 'edit',
          });
      } catch (err) {
        setError((err as Error)?.message ?? 'Failed to open entry');
      } finally {
        setLoading(false);
      }
    },
    [adapter]
  );

  const openCreate = useCallback(
    async ({ parentId, parentType, parentField }: CreateOptions) => {
      setError(null);
      setLoading(true);
      try {
        // Resolve the parent Type (via locate if the caller didn't pass it).
        let pType = parentType ?? null;
        if (!pType) pType = (await adapter.locate(parentId))?.type ?? null;
        if (!pType) {
          setError(`Cannot resolve the parent type for "${parentId}"`);
          return;
        }

        // Resolve which Type to create from the parent field's allowedTypes.
        const parentSchema = schema.find((t) => t.__name === pType);
        const fieldDef = parentSchema?.fields.find((f) => f.__name === parentField);
        const allowed =
          fieldDef && (fieldDef.__type === 'reference' || fieldDef.__type === 'references')
            ? fieldDef.allowedTypes
            : [];
        const childType = allowed[0];
        if (!childType) {
          setError(`No creatable type for field "${parentField}"`);
          return;
        }

        // Create an empty child draft, then link it into the parent field.
        const created = await adapter.create(childType, {});
        if (fieldDef?.__type === 'references') {
          const parent = await adapter.get(pType, parentId, {
            status: 'draft',
            includeUnpublished: true,
          });
          const current = Array.isArray(parent?.[parentField])
            ? (parent[parentField] as string[])
            : [];
          await adapter.patch(pType, parentId, {
            [parentField]: [...current, created.__id],
          });
        } else {
          await adapter.patch(pType, parentId, { [parentField]: created.__id });
        }

        // Open the new entry so the editor can fill it in.
        setTarget({ id: created.__id, type: childType, mode: 'create' });
      } catch (err) {
        setError((err as Error)?.message ?? 'Failed to create entry');
      } finally {
        setLoading(false);
      }
    },
    [adapter, schema]
  );

  const unlink = useCallback(
    async ({ parentId, parentType, parentField, childId }: UnlinkOptions) => {
      try {
        // Resolve the parent Type (via locate if the caller didn't pass it).
        let pType = parentType ?? null;
        if (!pType) pType = (await adapter.locate(parentId))?.type ?? null;
        if (!pType) throw new Error(`Cannot resolve the parent type for "${parentId}"`);

        // Drop the child id from the parent field (inverse of openCreate's link step).
        const parentSchema = schema.find((t) => t.__name === pType);
        const fieldDef = parentSchema?.fields.find((f) => f.__name === parentField);
        if (fieldDef?.__type === 'references') {
          const parent = await adapter.get(pType, parentId, {
            status: 'draft',
            includeUnpublished: true,
          });
          const current = Array.isArray(parent?.[parentField])
            ? (parent[parentField] as string[])
            : [];
          await adapter.patch(pType, parentId, {
            [parentField]: current.filter((id) => id !== childId),
          });
        } else {
          await adapter.patch(pType, parentId, { [parentField]: null });
        }

        // No drawer to close; ask the host to revalidate so the item disappears.
        onChanged?.();
        notify('success', 'Item removed');
      } catch (err) {
        notify('error', errorMessage(err));
      }
    },
    [adapter, schema, onChanged, notify]
  );

  const close = useCallback(() => {
    setTarget(null);
    setError(null);
  }, []);

  const isOpen = target !== null || loading || error !== null;

  const publicValue = useMemo<WidgetContextValue>(
    () => ({ inspect: inspectActive, isOpen, openEntry, openCreate, unlink, close }),
    [inspectActive, isOpen, openEntry, openCreate, unlink, close]
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
