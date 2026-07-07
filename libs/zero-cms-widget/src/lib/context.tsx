'use client';

/**
 * Widget controller: lets any part of a host app open the in-place edit drawer for
 * an entry by `__id`. The Type is resolved from the id via `adapter.locate` (so the
 * host only needs the id), then the drawer reuses zero-cms-app's EntryEditor.
 *
 * Drawers are a STACK: opening a child (edit or create) from inside a drawer layers
 * a new panel on top; closing it returns to the parent with its state intact.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ZeroCmsError } from '@usc/zero-cms-core';
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

/** One panel on the drawer stack. */
interface DrawerTarget {
  /** Stable React key + patch handle for this panel. */
  key: string;
  /** Entry id; null for a create panel (nothing created yet — link-on-save). */
  id: string | null;
  /** Type `__name`; null while `locate` is resolving it. */
  type: string | null;
  mode: 'edit' | 'create';
  focusField?: string;
  /** Resolving the type via `locate`. */
  loading?: boolean;
  error?: string | null;
  /** Create panels only: settled with the new id on save, or null on cancel. */
  onResult?: (createdId: string | null) => void;
}

interface WidgetContextValue {
  /** Inspect mode: when true, <ZeroCmsEntry>/<ZeroCmsEntryField> show edit affordances. */
  inspect: boolean;
  isOpen: boolean;
  openEntry: (id: string, opts?: OpenOptions) => Promise<void>;
  /** Create a new entry for a parent relation field, link it on save, and open its drawer. */
  openCreate: (opts: CreateOptions) => Promise<void>;
  /** Remove a child from a parent relation field (unlink only; entry survives). */
  unlink: (opts: UnlinkOptions) => Promise<void>;
  /** Close the whole stack. */
  close: () => void;
  /**
   * Sign out of the widget's own auth session (clears the local bearer token
   * + the httpOnly session cookie via `AuthClient.logout()`). Only present
   * when `<ZeroCmsWidget auth={...}>` is actually gating the widget — the
   * plain `adapter`-prop variant has no session to log out of, so this is
   * `undefined` there (`ZeroCmsBar` hides its Log out button accordingly).
   */
  logout?: () => void;
  /** The signed-in user's email (auth-gated variant only — see {@link logout}). */
  currentUserEmail?: string;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

/** Internal: also exposes the drawer stack + push/pop for the drawer host. */
interface WidgetInternal extends WidgetContextValue {
  stack: DrawerTarget[];
  /** Pop the top panel. */
  pop: () => void;
  /** Push an edit panel (alias of {@link WidgetContextValue.openEntry}). */
  pushEntry: (id: string, opts?: OpenOptions) => Promise<void>;
  /**
   * Push a create panel and resolve with the created id once the user saves it, or
   * null if they cancel. Nothing is linked until the caller acts on the id.
   */
  pushCreate: (type: string) => Promise<string | null>;
}
const InternalContext = createContext<WidgetInternal | null>(null);

export function WidgetProvider({
  children,
  inspect = false,
  onChanged,
  onLogout,
  currentUserEmail,
}: {
  children: ReactNode;
  inspect?: boolean;
  /** Called after a mutation the widget performs itself (e.g. unlink) so the host can revalidate. */
  onChanged?: () => void;
  /** Wired to `AuthClient.logout()` by `<ZeroCmsWidget auth={...}>`; absent for the plain-adapter variant. */
  onLogout?: () => void;
  /** Passed straight through to {@link WidgetContextValue.currentUserEmail}. */
  currentUserEmail?: string;
}) {
  const { adapter, schema, notify, currentUserId } = useZeroCms();
  const [stack, setStack] = useState<DrawerTarget[]>([]);
  const seq = useRef(0);

  // Inspect overlays (<ZeroCmsEntry>/<ZeroCmsEntryField>) clone host elements that
  // cross the RSC server->client boundary; the server sees opaque child references
  // while the client sees real elements, so SSR-ing the overlay markup desyncs and
  // throws a hydration mismatch. Gate inspect on mount so SSR + the first client
  // render are always the plain children, then enable the overlays client-side.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const inspectActive = hydrated && inspect;

  const pushTarget = useCallback((t: Omit<DrawerTarget, 'key'>): string => {
    const key = `d${++seq.current}`;
    setStack((s) => [...s, { ...t, key }]);
    return key;
  }, []);

  const patchTarget = useCallback((key: string, patch: Partial<DrawerTarget>) => {
    setStack((s) => s.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }, []);

  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  const openEntry = useCallback(
    async (id: string, opts?: OpenOptions) => {
      if (opts?.type) {
        pushTarget({ id, type: opts.type, focusField: opts.focusField, mode: 'edit' });
        return;
      }
      // Push immediately (loading), then patch this exact panel by key once located,
      // so a concurrently-pushed panel is never clobbered by index.
      const key = pushTarget({
        id,
        type: null,
        focusField: opts?.focusField,
        mode: 'edit',
        loading: true,
      });
      try {
        const found = await adapter.locate(id);
        if (found) patchTarget(key, { id: found.id, type: found.type, loading: false });
        else patchTarget(key, { loading: false, error: `No entry with id "${id}"` });
      } catch (err) {
        patchTarget(key, {
          loading: false,
          error: (err as Error)?.message ?? 'Failed to open entry',
        });
      }
    },
    [adapter, pushTarget, patchTarget]
  );

  const pushCreate = useCallback(
    (type: string) =>
      new Promise<string | null>((resolve) => {
        let settled = false;
        // Idempotent: create-success and cancel can't both resolve.
        const settle = (v: string | null) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        };
        if (!type) return settle(null);
        pushTarget({ id: null, type, mode: 'create', onResult: settle });
      }),
    [pushTarget]
  );

  const openCreate = useCallback(
    async ({ parentId, parentType, parentField }: CreateOptions) => {
      // Resolve the parent Type (via locate if the caller didn't pass it).
      let pType = parentType ?? null;
      if (!pType) pType = (await adapter.locate(parentId))?.type ?? null;
      if (!pType) {
        notify('error', `Cannot resolve the parent type for "${parentId}"`);
        return;
      }

      // Resolve which Type to create from the parent field's allowedTypes.
      const parentSchema = schema.find((t) => t.__name === pType);
      const fieldDef = parentSchema?.fields.find((f) => f.__name === parentField);
      const isRefs = fieldDef?.__type === 'references';
      const allowed =
        fieldDef && (fieldDef.__type === 'reference' || fieldDef.__type === 'references')
          ? fieldDef.allowedTypes
          : [];
      const childType = allowed[0];
      if (!childType) {
        notify('error', `No creatable type for field "${parentField}"`);
        return;
      }

      // Open a create panel; link only once it resolves on SAVE (cancel ⇒ no orphan).
      const createdId = await pushCreate(childType);
      if (!createdId) return;

      try {
        const parent = await adapter.get(pType, parentId, {
          status: 'draft',
          includeUnpublished: true,
        });
        if (!parent) throw new Error(`"${parentId}" no longer exists`);
        if (isRefs) {
          const current = Array.isArray(parent[parentField])
            ? (parent[parentField] as string[])
            : [];
          await adapter.patch(
            pType,
            parentId,
            { [parentField]: [...current, createdId] },
            currentUserId,
            parent.__lastEditedAt
          );
        } else {
          await adapter.patch(
            pType,
            parentId,
            { [parentField]: createdId },
            currentUserId,
            parent.__lastEditedAt
          );
        }
        onChanged?.();
        notify('success', 'Item added');
      } catch (err) {
        notify('error', errorMessage(err));
        // A conflict here just means the parent changed elsewhere since we
        // fetched it above — the new child entry itself was still created
        // successfully; onChanged() lets the host re-sync and the editor can
        // retry the link from fresh data.
        if (err instanceof ZeroCmsError && err.code === 'CONFLICT') onChanged?.();
      }
    },
    [adapter, schema, notify, onChanged, pushCreate, currentUserId]
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
        const parent = await adapter.get(pType, parentId, {
          status: 'draft',
          includeUnpublished: true,
        });
        if (!parent) throw new Error(`"${parentId}" no longer exists`);
        if (fieldDef?.__type === 'references') {
          const current = Array.isArray(parent[parentField])
            ? (parent[parentField] as string[])
            : [];
          await adapter.patch(
            pType,
            parentId,
            { [parentField]: current.filter((id) => id !== childId) },
            currentUserId,
            parent.__lastEditedAt
          );
        } else {
          await adapter.patch(
            pType,
            parentId,
            { [parentField]: null },
            currentUserId,
            parent.__lastEditedAt
          );
        }

        // No drawer to close; ask the host to revalidate so the item disappears.
        onChanged?.();
        notify('success', 'Item removed');
      } catch (err) {
        notify('error', errorMessage(err));
        if (err instanceof ZeroCmsError && err.code === 'CONFLICT') onChanged?.();
      }
    },
    [adapter, schema, onChanged, notify, currentUserId]
  );

  const close = useCallback(() => {
    // Settle any pending create resolvers with null so awaiting callers don't hang.
    setStack((s) => {
      for (const t of s) t.onResult?.(null);
      return [];
    });
  }, []);

  const isOpen = stack.length > 0;

  const publicValue = useMemo<WidgetContextValue>(
    () => ({
      inspect: inspectActive,
      isOpen,
      openEntry,
      openCreate,
      unlink,
      close,
      logout: onLogout,
      currentUserEmail,
    }),
    [inspectActive, isOpen, openEntry, openCreate, unlink, close, onLogout, currentUserEmail]
  );
  const internalValue = useMemo<WidgetInternal>(
    () => ({ ...publicValue, stack, pop, pushEntry: openEntry, pushCreate }),
    [publicValue, stack, pop, openEntry, pushCreate]
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
