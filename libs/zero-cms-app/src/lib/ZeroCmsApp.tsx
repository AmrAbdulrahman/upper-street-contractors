'use client';

/**
 * <ZeroCmsApp /> — the single high-level component. Owns navigation between the
 * Content, Types and Media sections. Navigation is URL-shaped via `path` (segments)
 * + `onNavigate` so a host router can deep-link `/admin/<section>/<type?>/<id?>`,
 * while the lib stays router-independent (works uncontrolled too).
 *
 * Inject an {@link Adapter}; optionally a rich-text editor. Tailwind-styled.
 *
 * For a Next.js host, prefer the split below (`ZeroCmsAdminLayout` in your
 * `layout.tsx`, `ZeroCmsAdminContent` in `page.tsx`) over this monolithic
 * component — see `admin-nav.tsx`'s docstring for why the split exists.
 * `ZeroCmsApp`/`CmsApp` just composes the two together, for hosts with no
 * layout/page boundary to put them in (e.g. a single-page mount, or tests).
 */

import { useEffect, type ReactNode } from 'react';
import { ROLE_LABELS, type Adapter, type SafeUser } from '@usc/zero-cms-core';
import {
  ZeroCmsProvider,
  useZeroCms,
  type RichTextComponent,
  type BlocksComponent,
  type NotifyFn,
} from './context';
import { SECTIONS } from './nav';
import { AdminNavProvider, useAdminNav } from './admin-nav';
import { ReferenceActionsProvider } from './reference-actions';
import { EntriesList, EntryEditor } from './entries';
import { TypeBuilder } from './type-builder';
import { MediaLibrary } from './components/media';
import { UsersPanel } from './users-panel';
import { Button, Spinner, cls, cx } from './components/ui';
import { AuthGate, type AuthConfig } from './auth/AuthGate';
import type { AuthClient } from './auth/auth-client';

export interface ZeroCmsAppProps {
  /** Inject an adapter directly (no auth), or use `auth` to manage one behind login. */
  adapter?: Adapter;
  /** Enable the login gate; the gate provides an authed adapter. */
  auth?: AuthConfig;
  richText?: RichTextComponent;
  /** Editor for `blocks` fields; defaults to the built-in BlocksEditor. */
  blocks?: BlocksComponent;
  /** Toast notifier for mutation feedback; forwarded to the provider. */
  notify?: NotifyFn;
  className?: string;
  /** URL path segments, e.g. ['entries','project','<id>']. Enables deep linking. */
  path?: string[];
  /** Called when navigation changes; wire to your router to update the URL. */
  onNavigate?: (path: string[]) => void;
}

export function ZeroCmsApp(props: ZeroCmsAppProps) {
  return (
    <ZeroCmsAdminLayout {...props}>
      <ZeroCmsAdminContent />
    </ZeroCmsAdminLayout>
  );
}

/** Alias matching the `<CmsApp />` name. */
export const CmsApp = ZeroCmsApp;

/**
 * The stable part: auth + the schema/media provider + the nav strip, Type
 * sidebar, and the main content pane (TypeBuilder / MediaLibrary / entries
 * list). Put this in a Next.js `layout.tsx` so it survives navigation between
 * Types/entries instead of being torn down and rebuilt by the App Router on
 * every catch-all segment change (see `admin-nav.tsx`).
 *
 * Everything here is genuinely stable across a *within-Type* entry switch too
 * — the entries list only needs to re-render (new `activeType`/`reloadKey`),
 * never remount, when you open a different entry. Only the actual selected
 * entry's editor is inherently tied to the URL segment; that's the one piece
 * that belongs in `children` (`<ZeroCmsAdminContent>`, in `page.tsx`) — a
 * first version of this split put the whole content pane there too, and Next
 * remounted it (and the list along with it — losing search/filter state, plus
 * a visible reload flash of an already-loaded list) on every single entry
 * open, since a Next "page" component isn't guaranteed to survive navigation
 * the way `layout.tsx` is, even when its own props never change.
 */
export function ZeroCmsAdminLayout({
  adapter,
  auth,
  richText,
  blocks,
  notify,
  className,
  path,
  onNavigate,
  children,
}: ZeroCmsAppProps & { children: ReactNode }) {
  if (auth) {
    return (
      <AuthGate config={auth}>
        {(authedAdapter, ctx) => (
          <ZeroCmsProvider
            adapter={authedAdapter}
            richText={richText}
            blocks={blocks}
            notify={notify}
            currentUserId={ctx.user.__id}
          >
            <AdminNavProvider path={path} onNavigate={onNavigate}>
              <AdminChrome
                className={className}
                user={ctx.user}
                onLogout={ctx.logout}
                authClient={ctx.client}
              >
                {children}
              </AdminChrome>
            </AdminNavProvider>
          </ZeroCmsProvider>
        )}
      </AuthGate>
    );
  }
  if (!adapter) throw new Error('ZeroCmsApp requires either `adapter` or `auth`');
  return (
    <ZeroCmsProvider adapter={adapter} richText={richText} blocks={blocks} notify={notify}>
      <AdminNavProvider path={path} onNavigate={onNavigate}>
        <AdminChrome className={className}>{children}</AdminChrome>
      </AdminNavProvider>
    </ZeroCmsProvider>
  );
}

/** Shown in place of an admin-only pane for lower roles (deep links included). */
function AdminOnlyPane({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm space-y-2 text-center">
        <div aria-hidden="true" className="text-2xl">
          🔒
        </div>
        <p className="text-sm font-medium text-neutral-900">{children}</p>
        <p className="text-xs text-neutral-500">Ask an administrator if you need a change here.</p>
      </div>
    </div>
  );
}

function AdminChrome({
  className,
  user,
  onLogout,
  authClient,
  children,
}: {
  className?: string;
  user?: SafeUser;
  onLogout?: () => void;
  authClient?: AuthClient;
  children: ReactNode;
}) {
  const { schema, schemaLoading } = useZeroCms();
  const { nav, go, reloadKey } = useAdminNav();
  const activeType = schema.find((t) => t.__name === nav.typeName);

  // No-auth hosting (a bare `adapter`, dev/tests) has no roles at all — full
  // access, minus the Users tab (there's no auth endpoint to manage users on).
  const isAdmin = user ? user.role === 'admin' : true;
  const showUsers = isAdmin && !!user && !!authClient;
  const sections = SECTIONS.filter((s) => s.id !== 'users' || showUsers);

  // Default to the first type when landing on Content without one selected.
  useEffect(() => {
    if (nav.section === 'entries' && !nav.typeName && schema.length) {
      go({ section: 'entries', typeName: schema[0].__name, isNew: false });
    }
  }, [nav.section, nav.typeName, schema, go]);

  return (
    <div
      className={cx(
        // `h-full` fills a height-constrained host (e.g. the Next admin shell's
        // viewport-height flex column); `min-h-[32rem]` is the floor for hosts
        // that don't constrain height at all, so this degrades gracefully.
        'zero-cms flex h-full min-h-[32rem] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900',
        className
      )}
    >
      <nav className="flex w-44 shrink-0 flex-col gap-1 border-r border-neutral-200 bg-white p-3">
        <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          zero-cms
        </div>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => go({ section: s.id, isNew: false })}
            className={cx(
              'rounded-md px-3 py-2 text-left text-sm font-medium',
              nav.section === s.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'
            )}
          >
            {s.label}
          </button>
        ))}
        {user && (
          <div className="mt-auto space-y-1 border-t border-neutral-200 pt-2">
            <div className="truncate px-2 text-xs text-neutral-500" title={user.email}>
              {user.firstName ? `${user.firstName} ${user.lastName ?? ''}` : user.email}
              <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] uppercase">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <Button onClick={onLogout} className="w-full justify-start text-sm">
              Sign out
            </Button>
          </div>
        )}
      </nav>

      {/* Content: a side panel of Types (one per type), not a dropdown. */}
      {nav.section === 'entries' && (
        <aside className="w-48 shrink-0 space-y-1 overflow-auto border-r border-neutral-200 bg-white p-3">
          <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Types
          </div>
          {schema.map((t) => (
            <button
              key={t.__name}
              onClick={() => go({ section: 'entries', typeName: t.__name, isNew: false })}
              className={cx(
                'w-full truncate rounded-md px-3 py-2 text-left text-sm',
                nav.typeName === t.__name
                  ? 'bg-neutral-100 font-medium text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50'
              )}
            >
              {t.label ?? t.__name}
            </button>
          ))}
          {schema.length === 0 && (
            <span className="px-2 text-xs text-neutral-400">No types yet.</span>
          )}
        </aside>
      )}

      <main className="flex-1 overflow-auto p-5">
        {schemaLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : nav.section === 'types' ? (
          isAdmin ? (
            <TypeBuilder />
          ) : (
            <AdminOnlyPane>You need admin privileges to edit content types.</AdminOnlyPane>
          )
        ) : nav.section === 'users' ? (
          showUsers && user && authClient ? (
            <UsersPanel client={authClient} currentUser={user} />
          ) : (
            <AdminOnlyPane>You need admin privileges to manage users.</AdminOnlyPane>
          )
        ) : nav.section === 'media' ? (
          <MediaLibrary />
        ) : activeType ? (
          <EntriesList
            key={activeType.__name}
            refreshToken={reloadKey}
            type={activeType}
            onOpen={(id) =>
              go({ section: 'entries', typeName: activeType.__name, entryId: id, isNew: false })
            }
            onNew={() => go({ section: 'entries', typeName: activeType.__name, isNew: true })}
          />
        ) : (
          <p className="text-sm text-neutral-500">Select a type.</p>
        )}
      </main>

      {children}
    </div>
  );
}

/**
 * The changing part: just the selected entry's editor drawer, when there is
 * one. Put this in `page.tsx`, inside `<ZeroCmsAdminLayout>` from the layout
 * above — it reads everything it needs from context, no props. This is the
 * one piece that's *supposed* to be tied to the URL segment (a distinct
 * entryId is a distinct editor instance, by design — see the `key` below), so
 * Next re-invoking the page component for it is the correct, not wasted, unit
 * of remount.
 */
export function ZeroCmsAdminContent() {
  const { schema } = useZeroCms();
  const { nav, go, bumpReload, referenceActions } = useAdminNav();
  const activeType = schema.find((t) => t.__name === nav.typeName);

  if (!((nav.entryId || nav.isNew) && activeType && nav.section === 'entries')) return null;

  return (
    <aside className={cx(cls.card, 'w-[28rem] shrink-0 overflow-auto border-l p-5')}>
      <ReferenceActionsProvider value={referenceActions}>
        <EntryEditor
          key={nav.entryId ?? 'new'}
          type={activeType}
          entryId={nav.entryId}
          onClose={() => go({ section: 'entries', typeName: activeType.__name, isNew: false })}
          onChanged={bumpReload}
        />
      </ReferenceActionsProvider>
    </aside>
  );
}
