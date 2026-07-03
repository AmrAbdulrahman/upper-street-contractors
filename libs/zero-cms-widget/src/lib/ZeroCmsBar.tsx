'use client';

/**
 * <ZeroCmsBar> — a floating editor toolbar for the public site, rendered inside
 * <ZeroCmsWidget>. Toggles inspect mode and batch-publishes every entry that has a
 * pending draft. The zero-cms replacement for the old Strapi "preview admin" bar.
 *
 * Router-independent: the host owns the inspect flag (`inspect`/`onToggleInspect`,
 * e.g. driven by a `?inspect` param). Publish actions use the widget's adapter, so
 * they require an editor session (hidden until then).
 */

import { useCallback, useEffect, useState } from 'react';
import { useZeroCms, useDraftRegistry, errorMessage, type DraftRef } from '@usc/zero-cms-app';

export interface ZeroCmsBarProps {
  inspect: boolean;
  onToggleInspect: () => void;
  /** Called after drafts are published, so the host can revalidate/refresh. */
  onChange?: () => void;
  className?: string;
}

const STORAGE_KEY = 'zero-cms-bar-minimized';
// Matches the strip's `h-9`; the app header + metadata buttons read this var and
// pin below the bar so the two stack instead of overlapping (issue: bar on top).
const BAR_OFFSET = '36px';

export function ZeroCmsBar({
  inspect,
  onToggleInspect,
  onChange,
  className,
}: ZeroCmsBarProps) {
  const { adapter, schema, notify } = useZeroCms();
  // Which entries currently have drafts is a shared store: the drawer marks them
  // optimistically on every (auto)save, and this bar re-syncs authoritatively.
  const { drafts, setDrafts, clearDraft } = useDraftRegistry();
  const [synced, setSynced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    setMinimized(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);
  const setMin = (v: boolean) => {
    setMinimized(v);
    localStorage.setItem(STORAGE_KEY, v ? 'true' : 'false');
  };

  // Offset the app header below the sticky bar (cleared while minimized / unmounted).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--admin-banner-offset', minimized ? '0px' : BAR_OFFSET);
    return () => {
      root.style.setProperty('--admin-banner-offset', '0px');
    };
  }, [minimized]);

  // Authoritative re-sync of the draft set (self-heals the optimistic registry).
  const refresh = useCallback(async () => {
    try {
      const found: DraftRef[] = [];
      // `hasDraft` is a derived filterable field in the query DSL (query-engine).
      for (const t of schema) {
        const { data } = await adapter.query(t.__name, {
          status: 'draft',
          where: { hasDraft: { eq: true } },
          includeUnpublished: true,
        });
        for (const e of data) found.push({ type: t.__name, id: e.__id });
      }
      setDrafts(found);
      setSynced(true);
    } catch {
      setSynced(false); // not signed in / no access — hide publish
    }
  }, [adapter, schema, setDrafts]);

  // Sync on mount + whenever inspect toggles; between those the drawer keeps the
  // count live via the shared registry, so publishing reacts without a re-query.
  useEffect(() => {
    void refresh();
  }, [refresh, inspect]);

  const publishAll = async () => {
    if (!drafts.length) return;
    const n = drafts.length;
    setBusy(true);
    try {
      for (const d of drafts) {
        await adapter.publish(d.type, d.id);
        clearDraft(d.type, d.id);
      }
      await refresh();
      onChange?.();
      notify('success', `Published ${n} item${n > 1 ? 's' : ''}`);
    } catch (err) {
      notify('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMin(false)}
        aria-label="Show zero-cms bar"
        className="zero-cms fixed right-4 top-4 z-[1001] flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg hover:bg-neutral-700"
      >
        ✎
      </button>
    );
  }

  const btn =
    'inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors';

  return (
    <div
      role="region"
      aria-label="zero-cms editor bar"
      className={`zero-cms sticky inset-x-0 top-0 z-[1000] flex h-9 items-center gap-2 border-b border-white/20 bg-neutral-900 px-3 text-white ${className ?? ''}`}
    >
      <span className="mr-auto text-xs font-semibold tracking-wide uppercase text-white/60">
        zero-cms
      </span>

      <button
        type="button"
        onClick={onToggleInspect}
        aria-pressed={inspect}
        className={`${btn} ${inspect ? 'border-white bg-white/25 text-white' : 'border-white/60 text-white hover:bg-white/15'}`}
      >
        {inspect ? 'Turn off edit mode' : 'Turn on edit mode'}
      </button>

      <a
        href="/admin"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the CMS admin in a new tab"
        className={`${btn} border-white/60 text-white hover:bg-white/15`}
      >
        Open CMS
      </a>

      {synced ? (
        <button
          type="button"
          onClick={publishAll}
          disabled={busy || drafts.length === 0}
          aria-label="Publish all drafts"
          className={`${btn} ${
            drafts.length > 0
              ? 'border-green-400 bg-green-500/20 text-green-100 hover:bg-green-500/30'
              : 'border-white/20 text-white/50'
          } disabled:cursor-default`}
        >
          {busy
            ? 'Publishing…'
            : drafts.length === 0
              ? 'Nothing to publish'
              : `Publish ${drafts.length} item${drafts.length > 1 ? 's' : ''}`}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setMin(true)}
        aria-label="Minimize"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/15"
      >
        –
      </button>
    </div>
  );
}
