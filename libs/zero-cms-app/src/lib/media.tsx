'use client';

/** Media section: upload, preview, and delete media (blocked while referenced). */

import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@usc/zero-cms-core';
import { useZeroCms } from './context';
import { Badge, Button, EmptyState, Spinner, cls, cx } from './ui';
import { errorMessage } from './util';

function MediaThumb({ item }: { item: MediaItem }) {
  const { adapter } = useZeroCms();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (item.kind !== 'image') return;
    let revoke: string | null = null;
    let live = true;
    void adapter.getMedia(item.id).then(({ bytes }) => {
      if (!live) return;
      const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: item.mime }));
      revoke = u;
      setUrl(u);
    });
    return () => {
      live = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [adapter, item.id, item.kind, item.mime]);

  if (item.kind === 'image')
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={item.filename} className="h-28 w-full rounded object-cover" />
    ) : (
      <div className="flex h-28 items-center justify-center rounded bg-neutral-100">
        <Spinner />
      </div>
    );

  return (
    <div className="flex h-28 items-center justify-center rounded bg-neutral-100 text-xs text-neutral-500">
      {item.kind}
    </div>
  );
}

export function MediaLibrary() {
  const { media, adapter, refreshMedia } = useZeroCms();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        await adapter.putMedia(bytes, {
          filename: file.name,
          mime: file.type || 'application/octet-stream',
        });
      }
      await refreshMedia();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await adapter.deleteMedia(id);
      await refreshMedia();
    } catch (err) {
      setError(errorMessage(err));
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
              <button
                onClick={() => remove(m.id)}
                className="text-xs text-red-600 hover:underline"
              >
                delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
