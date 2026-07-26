'use client';

/**
 * Widget controller: lets any part of a host app open the in-place edit drawer for
 * an entry by `__id`. The Type is resolved from the id via `adapter.locate` (so the
 * host only needs the id), then the drawer reuses zero-cms-app's EntryEditor.
 *
 * Drawers are a STACK: opening a child (edit or create) from inside a drawer layers
 * a new panel on top; closing it returns to the parent with its state intact.
 *
 * Beyond editing one entry, this also owns the in-place mutations the Section
 * builder needs on a parent's relation field — `openCreate` (Type picker →
 * create → link at a position), `link`, `unlink` and `reorder`. All four share
 * one CAS-patched spine (`mutateParentField`) and write to the parent's
 * `__draft` immediately; there is no form to save.
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
import {
  useZeroCms,
  errorMessage,
  type PickReferenceOptions,
  type TypePickResult,
} from '@usc/zero-cms-app';

export interface OpenOptions {
  /** Skip the `locate` round-trip if the caller already knows the Type. */
  type?: string;
  /** Field `__name` to scroll to + highlight when the drawer opens. */
  focusField?: string;
}

/** Identifies one relation field on one parent entry — the target of every op below. */
export interface ParentFieldRef {
  /** The parent entry holding the relation. */
  parentId: string;
  /** Parent Type `__name`; resolved via `locate` when omitted. */
  parentType?: string | null;
  /** The parent's `reference`/`references` field. */
  parentField: string;
}

export interface CreateOptions extends ParentFieldRef {
  /**
   * Insert position within a `references` array. Appends when omitted (and is
   * ignored for a One-to-One, which has no positions).
   */
  atIndex?: number;
  /**
   * Skip the Type picker because the caller already knows what to create.
   * Omit to let the editor choose from the field's `allowedTypes`.
   */
  childType?: string;
}

export interface UnlinkOptions extends ParentFieldRef {
  /** The child entry id to remove from the field. The entry itself is NOT deleted. */
  childId: string;
}

export interface LinkOptions extends ParentFieldRef {
  /** An EXISTING entry id to link in (no entry is created). */
  childId: string;
  /** Insert position; appends when omitted. Re-linking an already-linked id is a no-op. */
  atIndex?: number;
}

export interface ReorderOptions extends ParentFieldRef {
  /** Current index of the child being moved. */
  from: number;
  /** Index it should end up at. */
  to: number;
}

/**
 * Everything the Type picker needs. Parent info is OPTIONAL: an insert slot
 * always knows it, but the same picker is also opened from a relation field
 * inside an Edit drawer, which only knows the field. Absent ⇒ no usage counts.
 *
 * Structurally identical to `PickReferenceOptions` — the picker is reached
 * through `ReferenceActions.pickReference`, so the two must not drift.
 */
export type TypePickerContext = PickReferenceOptions;

/** One panel on the drawer stack. */
interface DrawerTarget {
  /** Stable React key + patch handle for this panel. */
  key: string;
  /** Entry id; null for a create or pick-type panel (nothing created yet). */
  id: string | null;
  /** Type `__name`; null for a pick-type panel, or while `locate` is resolving it. */
  type: string | null;
  mode: 'edit' | 'create' | 'pick-type';
  focusField?: string;
  /** Resolving the type via `locate`. */
  loading?: boolean;
  error?: string | null;
  /** Create panels only: settled with the new id on save, or null on cancel. */
  onResult?: (createdId: string | null) => void;
  /** pick-type panels only: what to offer and where it's going. */
  pick?: TypePickerContext;
  /** pick-type panels only: settled with the choice, or null on cancel. */
  onPick?: (result: TypePickResult | null) => void;
}

interface WidgetContextValue {
  /** Inspect mode: when true, <ZeroCmsEntry>/<ZeroCmsEntryField> show edit affordances. */
  inspect: boolean;
  isOpen: boolean;
  openEntry: (id: string, opts?: OpenOptions) => Promise<void>;
  /**
   * Add an entry to a parent relation field: pick a Type (or reuse an existing
   * entry), create it, link it on save, and open its drawer. `atIndex` inserts
   * rather than appends.
   */
  openCreate: (opts: CreateOptions) => Promise<void>;
  /**
   * Create a standalone entry of `type` — no parent, nothing linked. Resolves
   * with the new id once saved, or null on cancel.
   *
   * For content that is queried by Type rather than held in some parent's
   * relation field (a Blog Post reached from the Blogs index, a Project from the
   * Projects index). Those have no parent to hang an "+ Add" off, so without
   * this the only way to make one is the Content admin.
   */
  createEntry: (type: string) => Promise<string | null>;
  /** Link an entry that already exists into a parent relation field. */
  link: (opts: LinkOptions) => Promise<void>;
  /** Remove a child from a parent relation field (unlink only; entry survives). */
  unlink: (opts: UnlinkOptions) => Promise<void>;
  /** Move a child within a `references` array (no-op on a One-to-One). */
  reorder: (opts: ReorderOptions) => Promise<void>;
  /** Close the whole stack. */
  close: () => void;
  /**
   * Tell the host that content changed outside the drawer, so it can revalidate
   * (the website wires this to `router.refresh()`). The drawer and the relation
   * mutations call it themselves; this exposes it to in-page controls that write
   * through the adapter directly — e.g. `<ZeroCmsEntryActions>` publishing an
   * entry, after which the page must re-render to stop showing it as a draft.
   */
  refresh: () => void;
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
  /**
   * Push a Type-picker panel and resolve with the editor's choice, or null on
   * cancel. Nothing is created or linked until the caller acts on the result.
   */
  pushTypePicker: (ctx: TypePickerContext) => Promise<TypePickResult | null>;
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

  const pushTypePicker = useCallback(
    (pick: TypePickerContext) =>
      new Promise<TypePickResult | null>((resolve) => {
        let settled = false;
        // Idempotent: a pick and a cancel can't both resolve.
        const settle = (v: TypePickResult | null) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        };
        if (!pick.allowedTypes.length) return settle(null);
        pushTarget({ id: null, type: null, mode: 'pick-type', pick, onPick: settle });
      }),
    [pushTarget]
  );

  /**
   * The shared spine of every in-place relation mutation (link / unlink /
   * reorder). Resolves the parent Type, reads its DRAFT values, hands the
   * field's current ids to `next`, and CAS-patches the result back using the
   * parent's own `__lastEditedAt` as the token (ADR 0009).
   *
   * `next` always receives an array even for a One-to-One, so callers branch on
   * `isList` rather than on the raw value's shape.
   */
  const mutateParentField = useCallback(
    async (
      { parentId, parentType, parentField }: ParentFieldRef,
      next: (current: string[], isList: boolean) => unknown,
      successMessage?: string
    ): Promise<boolean> => {
      try {
        // Resolve the parent Type (via locate if the caller didn't pass it).
        let pType = parentType ?? null;
        if (!pType) pType = (await adapter.locate(parentId))?.type ?? null;
        if (!pType) throw new Error(`Cannot resolve the parent type for "${parentId}"`);

        const fieldDef = schema
          .find((t) => t.__name === pType)
          ?.fields.find((f) => f.__name === parentField);
        const isList = fieldDef?.__type === 'references';

        const parent = await adapter.get(pType, parentId, {
          status: 'draft',
          includeUnpublished: true,
        });
        if (!parent) throw new Error(`"${parentId}" no longer exists`);

        const raw = parent[parentField];
        const current = Array.isArray(raw)
          ? raw.filter((v): v is string => typeof v === 'string')
          : typeof raw === 'string' && raw
            ? [raw]
            : [];

        await adapter.patch(
          pType,
          parentId,
          { [parentField]: next(current, isList) },
          currentUserId,
          parent.__lastEditedAt
        );

        // No drawer to close; ask the host to revalidate so the page re-renders.
        onChanged?.();
        if (successMessage) notify('success', successMessage);
        return true;
      } catch (err) {
        notify('error', errorMessage(err));
        // A conflict here just means the parent changed elsewhere since we
        // fetched it above — any entry we created on the way still exists.
        // onChanged() lets the host re-sync so the editor can retry from
        // fresh data.
        if (err instanceof ZeroCmsError && err.code === 'CONFLICT') onChanged?.();
        return false;
      }
    },
    [adapter, schema, notify, onChanged, currentUserId]
  );

  const link = useCallback(
    async ({ childId, atIndex, ...parent }: LinkOptions) => {
      await mutateParentField(
        parent,
        (current, isList) => {
          if (!isList) return childId;
          if (current.includes(childId)) return current; // already linked — no dupes
          const at =
            atIndex == null ? current.length : Math.max(0, Math.min(atIndex, current.length));
          return [...current.slice(0, at), childId, ...current.slice(at)];
        },
        'Item added'
      );
    },
    [mutateParentField]
  );

  const unlink = useCallback(
    async ({ childId, ...parent }: UnlinkOptions) => {
      await mutateParentField(
        parent,
        (current, isList) => (isList ? current.filter((id) => id !== childId) : null),
        'Item removed'
      );
    },
    [mutateParentField]
  );

  const reorder = useCallback(
    async ({ from, to, ...parent }: ReorderOptions) => {
      // No success toast: a drag ends in a visible move, and one toast per drop
      // during a re-arrange is pure noise.
      await mutateParentField(parent, (current, isList) => {
        if (!isList || from === to || from < 0 || from >= current.length) return current;
        const at = Math.max(0, Math.min(to, current.length - 1));
        const ids = [...current];
        const [moved] = ids.splice(from, 1);
        ids.splice(at, 0, moved);
        return ids;
      });
    },
    [mutateParentField]
  );

  const openCreate = useCallback(
    async ({ parentId, parentType, parentField, atIndex, childType }: CreateOptions) => {
      // Resolve the parent Type (via locate if the caller didn't pass it).
      let pType = parentType ?? null;
      if (!pType) pType = (await adapter.locate(parentId))?.type ?? null;
      if (!pType) {
        notify('error', `Cannot resolve the parent type for "${parentId}"`);
        return;
      }

      const fieldDef = schema
        .find((t) => t.__name === pType)
        ?.fields.find((f) => f.__name === parentField);
      const allowed =
        fieldDef && (fieldDef.__type === 'reference' || fieldDef.__type === 'references')
          ? fieldDef.allowedTypes
          : [];
      if (!allowed.length) {
        notify('error', `No creatable type for field "${parentField}"`);
        return;
      }

      // Which entry ends up linked: a brand-new one, or an existing one the
      // editor chose to reuse. The picker pops itself as soon as it resolves —
      // deliberately NOT left underneath the create panel, because "Cancel" on
      // a create form reads as "abandon this", not "take me back a step".
      const picked: TypePickResult | null = childType
        ? { kind: 'create', type: childType }
        : await pushTypePicker({
            parentId,
            parentType: pType,
            parentField,
            allowedTypes: allowed,
            fieldLabel: fieldDef?.label ?? parentField,
          });
      if (!picked) return;

      // Create panels link only once they resolve on SAVE (cancel ⇒ no orphan).
      const childId = picked.kind === 'link' ? picked.id : await pushCreate(picked.type);
      if (!childId) return;

      await link({ parentId, parentType: pType, parentField, childId, atIndex });
    },
    [adapter, schema, notify, pushCreate, pushTypePicker, link]
  );

  const close = useCallback(() => {
    // Settle any pending create/pick resolvers with null so awaiting callers
    // don't hang (openCreate awaits both in sequence).
    setStack((s) => {
      for (const t of s) {
        t.onResult?.(null);
        t.onPick?.(null);
      }
      return [];
    });
  }, []);

  const isOpen = stack.length > 0;

  const refresh = useCallback(() => onChanged?.(), [onChanged]);

  const publicValue = useMemo<WidgetContextValue>(
    () => ({
      inspect: inspectActive,
      isOpen,
      openEntry,
      openCreate,
      createEntry: pushCreate,
      link,
      unlink,
      reorder,
      close,
      refresh,
      logout: onLogout,
      currentUserEmail,
    }),
    [
      inspectActive,
      isOpen,
      openEntry,
      openCreate,
      pushCreate,
      link,
      unlink,
      reorder,
      close,
      refresh,
      onLogout,
      currentUserEmail,
    ]
  );
  const internalValue = useMemo<WidgetInternal>(
    () => ({ ...publicValue, stack, pop, pushEntry: openEntry, pushCreate, pushTypePicker }),
    [publicValue, stack, pop, openEntry, pushCreate, pushTypePicker]
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
