'use client';

/**
 * <ZeroCmsBar> — a floating editor toolbar for the public site, rendered inside
 * <ZeroCmsWidget>. Toggles inspect mode and batch-publishes every entry that has a
 * pending draft. The zero-cms replacement for the old Strapi "preview admin" bar.
 *
 * Router-independent: the host owns the inspect flag (`inspect`/`onToggleInspect`,
 * e.g. driven by a `?inspect` param) and the Close destination (`closeHref`, a plain
 * URL — the host resolves it from its own router, this component doesn't import
 * one). Publish actions use the widget's adapter, so they require an editor session
 * (hidden until then); Log out and the signed-in email both read from the widget's
 * own auth context (`<ZeroCmsWidget auth={...}>`) — absent (and hidden) for the
 * plain-adapter variant.
 */

import { useCallback, useEffect, useState } from 'react';
import { useZeroCms, useDraftRegistry, errorMessage, type DraftRef } from '@usc/zero-cms-app';
import { ZeroCmsError } from '@usc/zero-cms-core';
import { useZeroCmsWidget } from './context';

export interface ZeroCmsBarProps {
  inspect: boolean;
  onToggleInspect: () => void;
  /** Called after drafts are published, so the host can revalidate/refresh. */
  onChange?: () => void;
  /**
   * Where Close/Log out send the browser — a real `<a href>`, not a client
   * navigation, so it always reaches the host's exit-preview Route Handler
   * (e.g. `/admin/exit-preview?next=/bathrooms`) even when that's outside
   * this component's own routing knowledge. Omit to hide the Close button.
   */
  closeHref?: string;
  /**
   * Type name of a site-wide settings singleton (e.g. `site-meta-config`).
   * When set, the bar grows a Settings button on the left that opens that
   * entry's drawer in place — the site's name, logos, metadata, contact details
   * and menus are the one kind of content that belongs to no page, so there is
   * no pencil anywhere on the site that can reach them and the only route was
   * to leave for /admin/cms and hunt for the Type.
   *
   * The entry is looked up by Type, not by id: a singleton's id is generated
   * and would have to be threaded through the host as configuration. If none
   * exists yet the button creates one.
   */
  settingsType?: string;
  /** Label for that button. Defaults to "Settings". */
  settingsLabel?: string;
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
  closeHref,
  settingsType,
  settingsLabel = 'Settings',
  className,
}: ZeroCmsBarProps) {
  const { adapter, notify, currentUserId } = useZeroCms();
  const { logout, currentUserEmail, openEntry, createEntry } = useZeroCmsWidget();
  const [openingSettings, setOpeningSettings] = useState(false);
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
  // `listDrafts()` reads a maintained index (2 round trips total) instead of
  // querying every single Type in the schema to find which ones have a
  // hasDraft entry — with dozens of Types, that used to mean dozens of RPC
  // round trips just to render this bar's count.
  const refresh = useCallback(async () => {
    try {
      const drafts = await adapter.listDrafts();
      setDrafts(drafts.map((d): DraftRef => ({ ...d })));
      setSynced(true);
    } catch {
      setSynced(false); // not signed in / no access — hide publish
    }
  }, [adapter, setDrafts]);

  // Sync on mount + whenever inspect toggles; between those the drawer keeps the
  // count live via the shared registry, so publishing reacts without a re-query.
  useEffect(() => {
    void refresh();
  }, [refresh, inspect]);

  const publishAll = async () => {
    if (!drafts.length) return;
    const n = drafts.length;
    setBusy(true);
    let conflicted = false;
    try {
      for (const d of drafts) {
        try {
          // The registry's token may be stale (optimistic markDraft entries carry
          // none at all) — refetch when missing so we CAS against a real value.
          let token = d.lastEditedAt;
          if (!token) {
            const fresh = await adapter.get(d.type, d.id, {
              status: 'draft',
              includeUnpublished: true,
            });
            token = fresh?.__lastEditedAt;
          }
          if (!token) continue; // entry vanished since the last sync
          await adapter.publish(d.type, d.id, currentUserId, token);
          clearDraft(d.type, d.id);
        } catch (err) {
          if (err instanceof ZeroCmsError && err.code === 'CONFLICT') {
            conflicted = true;
            continue; // someone else touched it — leave it, refresh() below re-syncs
          }
          throw err;
        }
      }
      await refresh();
      onChange?.();
      if (conflicted) {
        notify('error', 'Some items changed elsewhere and were skipped — re-check and retry');
      } else {
        notify('success', `Published ${n} item${n > 1 ? 's' : ''}`);
      }
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

  /**
   * Open the settings singleton. Queries by Type rather than holding an id, and
   * creates the entry when the site has never had one — a settings button that
   * errors because nobody has made the record yet is worse than one that makes it.
   */
  const openSettings = async () => {
    if (!settingsType || openingSettings) return;
    setOpeningSettings(true);
    try {
      const { data } = await adapter.query(settingsType, {
        status: 'draft',
        includeUnpublished: true,
        page: { limit: 1 },
      });
      const existing = data[0]?.__id;
      if (existing) await openEntry(existing, { type: settingsType });
      else await createEntry(settingsType);
    } catch (e) {
      notify('error', errorMessage(e));
    } finally {
      setOpeningSettings(false);
    }
  };

  const btn =
    'inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors';

  return (
    <div
      role="region"
      aria-label="zero-cms editor bar"
      className={`zero-cms sticky inset-x-0 top-0 z-[1000] flex h-9 items-center gap-2 border-b border-white/20 bg-neutral-900 px-3 text-white ${className ?? ''}`}
    >
      <span className="text-xs font-semibold tracking-wide uppercase text-white/60">
        zero-cms
      </span>

      {/* Settings sits on the LEFT, next to the wordmark, and carries the
          `mr-auto` that used to be on it — everything else on this bar acts on
          the page you are looking at, while this one acts on the whole site.
          Keeping it away from Publish/Close also keeps it away from the two
          buttons an editor presses in a hurry. */}
      {settingsType ? (
        <button
          type="button"
          onClick={openSettings}
          disabled={openingSettings}
          aria-label="Open site settings"
          className={`${btn} mr-auto border-white/60 text-white hover:bg-white/15 disabled:opacity-50`}
        >
          <span aria-hidden>⚙</span>
          {openingSettings ? 'Opening…' : settingsLabel}
        </button>
      ) : (
        <span className="mr-auto" />
      )}

      <button
        type="button"
        onClick={onToggleInspect}
        aria-pressed={inspect}
        className={`${btn} ${inspect ? 'border-white bg-white/25 text-white' : 'border-white/60 text-white hover:bg-white/15'}`}
      >
        {inspect ? 'Turn off edit mode' : 'Turn on edit mode'}
      </button>

      <a
        href="/admin/cms"
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

      {currentUserEmail ? (
        <span
          className="max-w-[14rem] truncate text-xs text-white/60"
          title={currentUserEmail}
        >
          {currentUserEmail}
        </span>
      ) : null}

      {logout ? (
        <button
          type="button"
          onClick={() => {
            // Clears the local bearer token + the httpOnly session cookie
            // (AuthClient.logout(), see ZeroCmsWidget.tsx), then leaves the
            // Draft Mode mirror the same way Close does — staying on an
            // /admin/* page with no session left is a dead end (proxy.ts
            // would just bounce the *next* navigation to the sign-in form
            // anyway; this skips straight there).
            logout();
            if (closeHref) window.location.href = closeHref;
          }}
          aria-label="Log out"
          className={`${btn} border-white/60 text-white hover:bg-white/15`}
        >
          Log out
        </button>
      ) : null}

      {closeHref ? (
        <a
          href={closeHref}
          aria-label="Close preview and return to the site"
          className={`${btn} border-white/60 text-white hover:bg-white/15`}
        >
          Close
        </a>
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
