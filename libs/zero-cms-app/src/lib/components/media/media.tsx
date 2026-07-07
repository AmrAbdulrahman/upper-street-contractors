'use client';

/** Media section: upload, preview, and delete media (blocked while referenced). */

import { useRef, useState } from 'react';
import { ZeroCmsError, type MediaItem } from '@usc/zero-cms-core';
import { useZeroCms } from '../../context';
import { Badge, Button, EmptyState, Field, Textarea, cls, cx } from '../ui';
import { errorMessage } from '../../util';

/** Human-readable byte size (B / KB / MB). */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Thumbnail for one media item — `item.url` is a real, public, CDN-backed
 * Vercel Blob URL (ADR 0008), so this just points an `<img>` at it directly;
 * no adapter round-trip/object-URL dance needed the way local-fs bytes did.
 * `className` sets the box size so the same component serves the library
 * grid and the asset picker.
 */
export function MediaThumb({
  item,
  className = 'h-28 w-full',
}: {
  item: MediaItem;
  className?: string;
}) {
  if (item.kind === 'image')
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.url}
        alt={item.filename}
        className={cx(className, 'rounded object-cover')}
      />
    );

  return (
    <div
      className={cx(
        className,
        'flex items-center justify-center rounded bg-neutral-100 text-xs text-neutral-500'
      )}
    >
      {item.kind}
    </div>
  );
}

export function MediaLibrary() {
  const { media, adapter, refreshMedia, notify, currentUserId } = useZeroCms();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);

  const upload = async (files: FileList) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        await adapter.putMedia(
          bytes,
          { filename: file.name, mime: file.type || 'application/octet-stream' },
          currentUserId
        );
      }
      await refreshMedia();
      notify('success', `Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      notify('error', msg);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Takes the whole item, not just the id — deleteMedia needs its current
  // updatedAt as the optimistic-concurrency token (ADR 0009).
  const remove = async (item: MediaItem) => {
    setError(null);
    try {
      await adapter.deleteMedia(item.id, currentUserId, item.updatedAt);
      notify('success', 'Media deleted');
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      notify('error', msg);
    } finally {
      // Re-syncs the list either way — including after a conflict, so a stale
      // "updated elsewhere" or "already deleted" item's card reflects reality.
      await refreshMedia();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <span className="text-sm text-neutral-500">{media.length} item(s)</span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {media.length === 0 ? (
        <EmptyState>No media yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className={cx(cls.card, 'space-y-2 p-2')}>
              <MediaThumb item={m} />
              <div className="flex items-center gap-1">
                <span className="flex-1 truncate text-xs text-neutral-600" title={m.filename}>
                  {m.filename}
                </span>
                <Badge>{m.kind}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditing(m)}
                  className="text-xs font-medium text-neutral-700 hover:underline"
                >
                  edit
                </button>
                <button
                  onClick={() => remove(m)}
                  className="text-xs text-red-600 hover:underline"
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MediaEditDrawer item={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/**
 * Slide-over to edit a media item's alt text. Shows immutable metadata (name,
 * type, size, dimensions, upload date) read-only + an editable alt field that
 * persists to `MediaItem.alternativeText` — the single source every app image
 * reads as its alt text. Built with in-lib primitives (no widget dependency).
 */
function MediaEditDrawer({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const { adapter, refreshMedia, notify, currentUserId } = useZeroCms();
  const [alt, setAlt] = useState(item.alternativeText ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adapter.updateMedia(
        item.id,
        { alternativeText: alt.trim() ? alt.trim() : undefined },
        currentUserId,
        item.updatedAt
      );
      notify('success', 'Alt text saved');
      onClose();
    } catch (err) {
      notify('error', errorMessage(err));
      if (err instanceof ZeroCmsError && err.code === 'CONFLICT') onClose(); // stale — force a re-open
    } finally {
      await refreshMedia();
      setSaving(false);
    }
  };

  return (
    <div
      className="zero-cms fixed inset-0 z-[1400] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Edit media"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cx(
          cls.card,
          'relative z-10 flex h-full w-[26rem] max-w-[90vw] flex-col gap-4 overflow-auto rounded-none border-l p-5'
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900">Edit media</h3>
          <Button onClick={onClose}>Close</Button>
        </div>

        <MediaThumb item={item} className="h-40 w-full" />

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-neutral-500">Name</dt>
          <dd className="truncate text-neutral-800" title={item.filename}>
            {item.filename}
          </dd>
          <dt className="text-neutral-500">Type</dt>
          <dd className="text-neutral-800">{item.mime}</dd>
          <dt className="text-neutral-500">Size</dt>
          <dd className="text-neutral-800">{formatBytes(item.size)}</dd>
          {item.width && item.height ? (
            <>
              <dt className="text-neutral-500">Dimensions</dt>
              <dd className="text-neutral-800">
                {item.width} × {item.height}
              </dd>
            </>
          ) : null}
          <dt className="text-neutral-500">Uploaded</dt>
          <dd className="text-neutral-800">
            {new Date(item.createdAt).toLocaleString()}
          </dd>
        </dl>

        <Field label="Alt text">
          <Textarea
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the image for screen readers + SEO"
          />
        </Field>

        <div className="mt-auto flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
