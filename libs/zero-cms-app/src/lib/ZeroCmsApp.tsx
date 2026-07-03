'use client';

/**
 * <ZeroCmsApp /> — the single high-level component. Owns navigation between the
 * Content, Types and Media sections. Navigation is URL-shaped via `path` (segments)
 * + `onNavigate` so a host router can deep-link `/admin/<section>/<type?>/<id?>`,
 * while the lib stays router-independent (works uncontrolled too).
 *
 * Inject an {@link Adapter}; optionally a rich-text editor. Tailwind-styled.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Adapter, SafeUser } from '@usc/zero-cms-core';
import { ZeroCmsProvider, useZeroCms, type RichTextComponent } from './context';
import { SECTIONS, type Section } from './nav';
import { EntriesList, EntryEditor } from './entries';
import { TypeBuilder } from './type-builder';
import { MediaLibrary } from './media';
import { Button, Spinner, cls, cx } from './ui';
import { AuthGate, type AuthConfig } from './auth/AuthGate';

export interface ZeroCmsAppProps {
  /** Inject an adapter directly (no auth), or use `auth` to manage one behind login. */
  adapter?: Adapter;
  /** Enable the login gate; the gate provides an authed adapter. */
  auth?: AuthConfig;
  richText?: RichTextComponent;
  className?: string;
  /** URL path segments, e.g. ['entries','project','<id>']. Enables deep linking. */
  path?: string[];
  /** Called when navigation changes; wire to your router to update the URL. */
  onNavigate?: (path: string[]) => void;
}

interface NavState {
  section: Section;
  typeName?: string;
  entryId?: string;
  isNew: boolean;
}

function parsePath(path: string[]): NavState {
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

function toPath(s: NavState): string[] {
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

export function ZeroCmsApp(props: ZeroCmsAppProps) {
  if (props.auth) {
    return (
      <AuthGate config={props.auth}>
        {(adapter, ctx) => (
          <ZeroCmsProvider adapter={adapter} richText={props.richText}>
            <Shell
              className={props.className}
              path={props.path}
              onNavigate={props.onNavigate}
              user={ctx.user}
              onLogout={ctx.logout}
            />
          </ZeroCmsProvider>
        )}
      </AuthGate>
    );
  }
  if (!props.adapter)
    throw new Error('ZeroCmsApp requires either `adapter` or `auth`');
  return (
    <ZeroCmsProvider adapter={props.adapter} richText={props.richText}>
      <Shell className={props.className} path={props.path} onNavigate={props.onNavigate} />
    </ZeroCmsProvider>
  );
}

/** Alias matching the `<CmsApp />` name. */
export const CmsApp = ZeroCmsApp;

function Shell({
  className,
  path,
  onNavigate,
  user,
  onLogout,
}: {
  className?: string;
  path?: string[];
  onNavigate?: (path: string[]) => void;
  user?: SafeUser;
  onLogout?: () => void;
}) {
  const { schema, schemaLoading } = useZeroCms();
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

  // Default to the first type when landing on Content without one selected.
  useEffect(() => {
    if (nav.section === 'entries' && !nav.typeName && schema.length) {
      go({ section: 'entries', typeName: schema[0].__name, isNew: false });
    }
  }, [nav.section, nav.typeName, schema, go]);

  const activeType = schema.find((t) => t.__name === nav.typeName);

  return (
    <div
      className={cx(
        'zero-cms flex min-h-[32rem] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900',
        className
      )}
    >
      <nav className="flex w-44 shrink-0 flex-col gap-1 border-r border-neutral-200 bg-white p-3">
        <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          zero-cms
        </div>
        {SECTIONS.map((s) => (
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
                {user.role}
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
              onClick={() =>
                go({ section: 'entries', typeName: t.__name, isNew: false })
              }
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
          <TypeBuilder />
        ) : nav.section === 'media' ? (
          <MediaLibrary />
        ) : activeType ? (
          <EntriesList
            key={`${activeType.__name}-${reloadKey}`}
            type={activeType}
            onOpen={(id) =>
              go({ section: 'entries', typeName: activeType.__name, entryId: id, isNew: false })
            }
            onNew={() =>
              go({ section: 'entries', typeName: activeType.__name, isNew: true })
            }
          />
        ) : (
          <p className="text-sm text-neutral-500">Select a type.</p>
        )}
      </main>

      {(nav.entryId || nav.isNew) && activeType && nav.section === 'entries' && (
        <aside className={cx(cls.card, 'w-[28rem] shrink-0 overflow-auto border-l p-5')}>
          <EntryEditor
            key={nav.entryId ?? 'new'}
            type={activeType}
            entryId={nav.entryId}
            onClose={() =>
              go({ section: 'entries', typeName: activeType.__name, isNew: false })
            }
            onChanged={() => setReloadKey((k) => k + 1)}
          />
        </aside>
      )}
    </div>
  );
}
