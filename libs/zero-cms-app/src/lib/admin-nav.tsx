'use client';

/**
 * Admin navigation state — split out of `<ZeroCmsApp>` so a host can render the
 * stable chrome (nav strip + Type sidebar) in a Next.js `layout.tsx` and only the
 * changing view (entries list / editor / TypeBuilder / MediaLibrary) in `page.tsx`.
 *
 * Why this exists: without that split, a single all-in-one component re-invoked by
 * a Next `[[...catchall]]` page for every navigation gets torn down and rebuilt in
 * full by the App Router itself (confirmed: switching Types remounted `<AuthGate>`
 * end to end — a fresh login-loading flash, full schema/media re-fetch, the works)
 * — Next only guarantees state survives across a nested page change for the parts
 * that actually live in `layout.tsx`, not for everything crammed into one page
 * component. `<ZeroCmsAdminLayout>`/`<ZeroCmsAdminContent>` are the split; the
 * monolithic `<ZeroCmsApp>` composes them back together for simple/uncontrolled use
 * (a single page.tsx, no layout split) — same behavior as before, unchanged.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Section } from './nav';

export interface NavState {
  section: Section;
  typeName?: string;
  entryId?: string;
  isNew: boolean;
}

export function parsePath(path: string[]): NavState {
  const [section, a, b] = path;
  if (section === 'types') return { section: 'types', typeName: a, isNew: false };
  if (section === 'media') return { section: 'media', isNew: false };
  return {
    section: 'entries',
    typeName: a,
    entryId: b && b !== 'new' ? b : undefined,
    isNew: b === 'new',
  };
}

export function toPath(s: NavState): string[] {
  if (s.section === 'types') return s.typeName ? ['types', s.typeName] : ['types'];
  if (s.section === 'media') return ['media'];
  const p = ['entries'];
  if (s.typeName) {
    p.push(s.typeName);
    if (s.isNew) p.push('new');
    else if (s.entryId) p.push(s.entryId);
  }
  return p;
}

export interface ReferenceActions {
  openReference: (id: string, type?: string) => void;
}

interface AdminNavValue {
  nav: NavState;
  go: (next: NavState) => void;
  reloadKey: number;
  bumpReload: () => void;
  referenceActions: ReferenceActions;
}

const AdminNavContext = createContext<AdminNavValue | null>(null);

export function AdminNavProvider({
  path,
  onNavigate,
  children,
}: {
  path?: string[];
  onNavigate?: (path: string[]) => void;
  children: React.ReactNode;
}) {
  const [internal, setInternal] = useState<string[]>(path ?? []);
  const [reloadKey, setReloadKey] = useState(0);

  // Sync when a controlled `path` prop changes (router back/forward).
  const pathKey = path?.join('/');
  useEffect(() => {
    if (path) setInternal(path);
  }, [pathKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = parsePath(internal);

  const go = useCallback(
    (next: NavState) => {
      const p = toPath(next);
      onNavigate?.(p);
      setInternal(p);
    },
    [onNavigate]
  );

  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Click-to-edit a referenced child navigates the single aside to it (browser back
  // returns). `createReference` is intentionally omitted: without a drawer stack the
  // aside can't defer the link (navigating unmounts the parent editor), so the
  // references editor hides "add new" in the admin app.
  const referenceActions = useMemo<ReferenceActions>(
    () => ({
      openReference: (id: string, type?: string) =>
        go({ section: 'entries', typeName: type ?? nav.typeName, entryId: id, isNew: false }),
    }),
    [go, nav.typeName]
  );

  const value = useMemo<AdminNavValue>(
    () => ({ nav, go, reloadKey, bumpReload, referenceActions }),
    [nav, go, reloadKey, bumpReload, referenceActions]
  );

  return <AdminNavContext.Provider value={value}>{children}</AdminNavContext.Provider>;
}

export function useAdminNav(): AdminNavValue {
  const ctx = useContext(AdminNavContext);
  if (!ctx) throw new Error('useAdminNav must be used within <ZeroCmsAdminLayout>');
  return ctx;
}
