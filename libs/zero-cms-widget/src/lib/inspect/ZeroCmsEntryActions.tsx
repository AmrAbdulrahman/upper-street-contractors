'use client';

/**
 * <ZeroCmsEntryActions> — Publish / Unpublish / Delete for the entry a page is
 * ABOUT, rendered inline in that page's own markup.
 *
 * The Edit drawer has carried these three since the beginning, but only for an
 * entry you had opened to edit. A Blog Post is the whole page, so publishing it
 * meant either opening its drawer just to reach the footer, or leaving for the
 * Content admin. The bar's "Publish all" is not a substitute either: it publishes
 * every pending draft in the session, which is the opposite of "publish this
 * post".
 *
 * In flow, not floating: it renders where the host puts it and scrolls with the
 * page, the same way the Blog index's "New blog post" button does. Inspect mode
 * off (or no widget at all) renders nothing, so it is inert on public pages.
 *
 * Delete confirms in place rather than through `window.confirm` — a native dialog
 * cannot say *what* is about to be deleted, and this one is irreversible.
 */

import { useCallback, useEffect, useState } from 'react';
import { ZeroCmsError, type OutputEntry, type ReferenceHit } from '@usc/zero-cms-core';
import {
  useZeroCmsOptional,
  useDraftRegistryOptional,
  describeReferenceHits,
  errorMessage,
} from '@usc/zero-cms-app';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry } from './entry-context';
import { useInspect } from './use-inspect';

export interface ZeroCmsEntryActionsProps {
  /**
   * Called after the entry is deleted — the page it described no longer exists,
   * so the host has to navigate away (the caller owns where to).
   */
  onDeleted?: () => void;
  /** What this entry is called in the button labels and confirm copy. */
  noun?: string;
  /** Extra classes on the wrapper row. */
  className?: string;
}

const BTN =
  'zero-cms inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export function ZeroCmsEntryActions({
  onDeleted,
  noun = 'post',
  className,
}: ZeroCmsEntryActionsProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  // Optional, like every other inspect wrapper: this renders on the PUBLIC page
  // too (a Blog Post mounts it in its own markup), and a public page has no
  // <ZeroCmsProvider> at all — the throwing `useZeroCms` failed the prerender.
  const zeroCms = useZeroCmsOptional();
  const draftReg = useDraftRegistryOptional();

  const adapter = zeroCms?.adapter ?? null;
  const entryId = ctx?.entryId ?? null;
  const typeName = ctx?.typeName ?? null;
  // `useInspect`, not `widget.inspect` — this whole row is markup the server didn't
  // send, so it must wait for this component's own hydration.
  const inspect = Boolean(useInspect() && adapter && entryId && typeName);

  /** The draft read, for `__status` / `hasDraft` / the CAS token (ADR 0009). */
  const [entry, setEntry] = useState<OutputEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!inspect || !adapter || !entryId || !typeName) return;
    try {
      setEntry(
        await adapter.get(typeName, entryId, { status: 'draft', includeUnpublished: true })
      );
    } catch {
      // Not signed in / no access — the buttons simply stay hidden.
      setEntry(null);
    }
  }, [adapter, entryId, typeName, inspect]);

  useEffect(() => {
    void load();
  }, [load]);

  // Narrows `adapter`/`zeroCms` for everything below, and is what keeps this inert
  // on a public page.
  if (!inspect || !adapter || !zeroCms || !entry || !entryId || !typeName) return null;
  const { schema, notify, currentUserId } = zeroCms;

  const published = entry.__status === 'published';
  const hasDraft = Boolean(entry.hasDraft);

  /** Every action shares this: run, report, re-read, ask the host to revalidate. */
  const run = async (fn: () => Promise<unknown>, successMessage: string, done?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      notify('success', successMessage);
      widget?.refresh();
      if (done) done();
      else await load();
    } catch (err) {
      const message =
        err instanceof ZeroCmsError && err.code === 'REFERENCE_INTEGRITY'
          ? await describeReferenceHits(err.details as ReferenceHit[], schema, adapter)
          : errorMessage(err);
      setError(message);
      notify('error', message);
      // A CONFLICT means the token we hold is stale — re-read so a retry uses a
      // fresh one instead of failing identically forever.
      await load();
    } finally {
      setBusy(false);
    }
  };

  const publish = () =>
    run(async () => {
      await adapter.publish(typeName, entryId, currentUserId, entry.__lastEditedAt);
      draftReg?.clearDraft(typeName, entryId);
    }, 'Published');

  const unpublish = () =>
    run(
      () => adapter.unpublish(typeName, entryId, currentUserId, entry.__lastEditedAt),
      `${noun[0].toUpperCase()}${noun.slice(1)} unpublished — it is no longer on the site`
    );

  const remove = () =>
    run(
      async () => {
        await adapter.delete(typeName, entryId, currentUserId, entry.__lastEditedAt);
        draftReg?.clearDraft(typeName, entryId);
      },
      'Deleted',
      // Don't re-read: the entry is gone, and this page went with it.
      () => onDeleted?.()
    );

  return (
    <div className={`zero-cms not-prose ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${published ? 'bg-green-500' : 'bg-neutral-400'}`}
          />
          {published ? 'Published' : 'Not published'}
          {hasDraft ? ' · unpublished changes' : ''}
        </span>

        {confirming ? (
          <>
            <span className="text-sm font-semibold text-red-700">
              Delete this {noun} permanently?
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className={`${BTN} border-neutral-300 text-neutral-700 hover:border-neutral-900`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className={`${BTN} border-red-600 bg-red-600 text-white hover:bg-red-700`}
            >
              {busy ? 'Deleting…' : `Yes, delete this ${noun}`}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              // Nothing to do when it is live and has no pending edits — the
              // button stays visible (disabled) so the state is legible.
              disabled={busy || (published && !hasDraft)}
              onClick={() => void publish()}
              className={`${BTN} border-green-600 bg-green-600 text-white hover:bg-green-700`}
            >
              {busy ? 'Working…' : published ? 'Publish changes' : 'Publish'}
            </button>
            {published && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void unpublish()}
                className={`${BTN} border-neutral-300 text-neutral-700 hover:border-neutral-900`}
              >
                Unpublish
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className={`${BTN} border-red-300 text-red-700 hover:border-red-600 hover:bg-red-50`}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
