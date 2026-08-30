'use client';

/**
 * The confirm behind the hover cluster's trash on an entry that IS its own
 * content — a Project card, not a section slot.
 *
 * One outcome, not two. `RemoveSectionDialog` offers "remove from the page"
 * before "delete permanently" because a section belongs to a page and unlinking
 * is usually what was meant. An entry queried by Type belongs to nothing: there
 * is nothing to unlink it from, so the only honest button is the irreversible
 * one, and the copy says so.
 *
 * The delete is attempted rather than pre-checked, exactly as in
 * `RemoveSectionDialog`: nothing answers "who references this" outside the
 * engine, and the refusal carries the holders with it — so a Project still
 * pinned by a Recent Work section reports which section, instead of a disabled
 * button with no explanation.
 */

import { useEffect, useState } from 'react';
import { ZeroCmsError, entryTitle, isUntitled, type ReferenceHit } from '@usc/zero-cms-core';
import { useZeroCms, describeReferenceHits, errorMessage, ui } from '@usc/zero-cms-app';
import { Drawer } from '../Drawer';
import { useZeroCmsWidget } from '../context';

export interface DeleteEntryDialogProps {
  entryId: string;
  /** The entry's Type `__name`. Without it there is nothing to address the delete to. */
  typeName: string | null;
  /** What this entry is called in the copy ("project"). */
  noun: string;
  /** Close, whatever the outcome. */
  onDone: () => void;
  /** Called with the id once the entry is really gone. */
  onDeleted?: (id: string) => void;
}

export function DeleteEntryDialog({
  entryId,
  typeName,
  noun,
  onDone,
  onDeleted,
}: DeleteEntryDialogProps) {
  const { adapter, schema, media, notify, currentUserId } = useZeroCms();
  const widget = useZeroCmsWidget();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The entry's own title, so the confirm names the thing it is about to destroy. */
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!typeName) return;
    void adapter
      .get(typeName, entryId, { status: 'draft', includeUnpublished: true })
      .then((entry) => {
        if (!live || !entry) return;
        // The Type's chosen title field (ADR 0021), not a guessed `title` key —
        // and nothing at all when it would only print "Untitled project".
        const type = schema.find((t) => t.__name === typeName);
        setLabel(isUntitled(type, entry, media) ? null : entryTitle(type, entry, media));
      })
      .catch(() => {
        // Not fatal — the confirm just names the noun alone.
      });
    return () => {
      live = false;
    };
  }, [adapter, entryId, typeName, schema, media]);

  const deleteForever = async () => {
    if (!typeName) {
      notify('error', `Can't delete — this ${noun}'s type is unknown.`);
      onDone();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Re-read for the CAS token (ADR 0009): the copy this page rendered from
      // may be minutes old, and a stale token fails the delete outright.
      const entry = await adapter.get(typeName, entryId, {
        status: 'draft',
        includeUnpublished: true,
      });
      if (!entry) throw new Error('Entry no longer exists');
      await adapter.delete(typeName, entryId, currentUserId, entry.__lastEditedAt);
      notify('success', `${noun[0].toUpperCase()}${noun.slice(1)} deleted`);
      widget.refresh();
      onDeleted?.(entryId);
      onDone();
    } catch (err) {
      const message =
        err instanceof ZeroCmsError && err.code === 'REFERENCE_INTEGRITY'
          ? await describeReferenceHits(err.details as ReferenceHit[], schema, adapter, media)
          : errorMessage(err);
      setError(message);
      notify('error', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      // Above anything already on the stack — the trash is reachable while a
      // drawer is open. Same depth as RemoveSectionDialog, which it never
      // co-exists with (one is a slot's trash, the other an entry's).
      depth={20}
      isTop
      busy={busy}
      onClose={onDone}
      label={`Delete ${noun}`}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Delete {noun}</h3>
          {label && <p className="mt-1 text-sm text-neutral-600">{label}</p>}
        </div>

        {/* Every space around an expression is explicit: this repo's JSX
            transform drops the one leading a text chunk, which silently ran the
            noun into the next word. */}
        <p className="text-sm text-neutral-600">
          {`This deletes the ${noun} and everything it holds. It can't be undone, and any page still pointing at it will refuse the delete rather than lose the link.`}
        </p>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <ui.Button onClick={onDone} disabled={busy}>
            Cancel
          </ui.Button>
          <ui.Button variant="danger" onClick={() => void deleteForever()} disabled={busy}>
            {busy ? 'Deleting…' : `Delete this ${noun}`}
          </ui.Button>
        </div>
      </div>
    </Drawer>
  );
}
