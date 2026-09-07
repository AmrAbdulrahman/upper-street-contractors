'use client';

/**
 * The confirm behind a section's trash button. Two distinct outcomes, because
 * they are genuinely different decisions:
 *
 * - **Remove from <noun>** — unlink only. The entry survives in the Content
 *   admin and can be linked back in.
 * - **Delete permanently** — unlink, then delete the entry outright.
 *
 * The delete is attempted rather than pre-checked. zero-cms Reference integrity
 * refuses to delete anything still referenced — and the PUBLISHED parent keeps
 * referencing this section until the parent's own unlink is published — so the
 * refusal is common and expected, not an edge case. There is no adapter op that
 * answers "who references X" (findReferencesTo is engine-internal), so a
 * pre-check would mean a new RPC + authorize entry purely for a nicer button
 * state. Instead we unlink first (which always succeeds and is what the editor
 * mostly wanted), then report the actual holders from the error's own hits.
 */

import { useState } from 'react';
import { ZeroCmsError, type ReferenceHit } from '@usc/zero-cms-core';
import { useZeroCms, describeReferenceHolders, errorMessage, ui } from '@usc/zero-cms-app';
import { Drawer } from '../Drawer';
import { useZeroCmsWidget } from '../context';

export interface RemoveSectionTarget {
  /** The child entry to remove. */
  childId: string;
  /** Its Type `__name`, needed to delete it. */
  childType: string | null;
  /** Human label for the confirm copy (Type label, or the entry's title). */
  childLabel: string;
  parentId: string;
  parentType: string | null;
  parentField: string;
}

export function RemoveSectionDialog({
  target,
  noun,
  onDone,
}: {
  target: RemoveSectionTarget;
  noun: string;
  onDone: () => void;
}) {
  const { adapter, schema, media, notify, currentUserId } = useZeroCms();
  const { unlink } = useZeroCmsWidget();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The holders a refused delete named — see `DeleteEntryDialog`. */
  const [holders, setHolders] = useState<string[] | null>(null);

  const { childId, childType, childLabel, parentId, parentType, parentField } = target;

  const removeOnly = async () => {
    setBusy(true);
    await unlink({ parentId, parentType, parentField, childId });
    setBusy(false);
    onDone();
  };

  const deleteForever = async (force = false) => {
    setBusy(true);
    setError(null);
    // Unlink first, unconditionally: it is the half that always works, and
    // leaving it applied means a refused delete still did what was asked.
    await unlink({ parentId, parentType, parentField, childId });
    if (!childType) {
      setBusy(false);
      notify('error', `Removed. Can't delete — the entry's type is unknown.`);
      onDone();
      return;
    }
    try {
      const entry = await adapter.get(childType, childId, {
        status: 'draft',
        includeUnpublished: true,
      });
      if (!entry) throw new Error('Entry no longer exists');
      await adapter.delete(childType, childId, currentUserId, entry.__lastEditedAt, force);
      notify('success', `${noun[0].toUpperCase()}${noun.slice(1)} deleted`);
      onDone();
    } catch (err) {
      if (err instanceof ZeroCmsError && err.code === 'REFERENCE_INTEGRITY') {
        const lines = await describeReferenceHolders(
          err.details as ReferenceHit[],
          schema,
          adapter,
          media
        );
        setHolders(lines);
        setError(null);
        notify('error', `Removed from the page. Still referenced by ${lines.length} field(s).`);
      } else {
        const msg = `Removed from the page. ${errorMessage(err)}`;
        setError(msg);
        notify('error', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      // Deliberately high depth: this sits above any drawer already on the
      // stack, since the trash is reachable while a drawer is open.
      depth={20}
      // A paragraph and two buttons: nothing here reads better at 64rem.
      resizable={false}
      isTop
      busy={busy}
      onClose={onDone}
      label={`Remove ${noun}`}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Remove {noun}</h3>
          <p className="mt-1 text-sm text-neutral-600">{childLabel}</p>
        </div>

        <p className="text-sm text-neutral-600">
          <strong className="font-semibold text-neutral-900">Remove from the page</strong> takes
          it off this page but keeps the content in the CMS, so you can add it back later.{' '}
          <strong className="font-semibold text-neutral-900">Delete permanently</strong> also
          deletes the content itself — that can&apos;t be undone.
        </p>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {holders && (
          <div className="space-y-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="font-semibold">
              {`Removed from the page. It can't be deleted yet — still in use here:`}
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {holders.map((holder) => (
                <li key={holder}>{holder}</li>
              ))}
            </ul>
            <p>
              {`Publishing this page usually clears its own hold. Force delete instead takes it out of every one of these — published versions included, which changes what visitors see there — and then deletes it.`}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <ui.Button onClick={onDone} disabled={busy}>
            Cancel
          </ui.Button>
          {holders ? (
            <ui.Button
              variant="danger"
              onClick={() => void deleteForever(true)}
              disabled={busy}
            >
              {busy ? 'Deleting…' : `Force delete (unlink from ${holders.length})`}
            </ui.Button>
          ) : (
            <>
              <ui.Button variant="primary" onClick={() => void removeOnly()} disabled={busy}>
                Remove from the page
              </ui.Button>
              <ui.Button
                variant="danger"
                onClick={() => void deleteForever()}
                disabled={busy}
              >
                Delete permanently
              </ui.Button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
