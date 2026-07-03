'use client';

/**
 * Rich picker for `asset` fields: a current-selection preview + remove, a
 * "choose from library" thumbnail grid (client-side search over the already
 * loaded media list), and inline upload through the adapter. The field value is
 * a single media id ('' = unset).
 */

import { useRef, useState, useTransition } from 'react';
import { useZeroCms } from '../../context';
import { MediaThumb } from '../media';
import { Button, Input, cx } from '../ui';

const ACCEPT_ATTR: Record<'image' | 'video' | 'any', string | undefined> = {
  image: 'image/*',
  video: 'video/*',
  any: undefined,
};

export function AssetPicker({
  value,
  onChange,
  accept = 'any',
}: {
  value: string;
  onChange: (id: string) => void;
  accept?: 'image' | 'video' | 'any';
}) {
  const { media, adapter, refreshMedia } = useZeroCms();
  const pool = media.filter((m) => accept === 'any' || m.kind === accept);
  const current = media.find((m) => m.id === value) ?? null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = search.trim().toLowerCase();
  const filtered = q ? pool.filter((m) => m.filename.toLowerCase().includes(q)) : pool;

  const choose = (id: string) => {
    onChange(id);
    setPickerOpen(false);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked
    if (!file) return;
    setError(null);
    startUpload(async () => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const item = await adapter.putMedia(bytes, {
          filename: file.name,
          mime: file.type || 'application/octet-stream',
        });
        await refreshMedia();
        choose(item.id);
      } catch (err) {
        setError((err as Error)?.message ?? 'Upload failed');
      }
    });
  };

  return (
    <div className="space-y-3">
      {current ? (
        <div className="flex items-center gap-3">
          <MediaThumb item={current} className="h-16 w-16 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
            {current.filename}
          </span>
          <Button onClick={() => onChange('')}>Remove</Button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No media selected.</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR[accept]}
        onChange={onPickFile}
        className="sr-only"
        aria-label="Upload a new file"
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPickerOpen((o) => !o)}>
          {pickerOpen ? 'Close library' : 'Choose from library'}
        </Button>
        <Button disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Uploading…' : 'Upload new'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {pickerOpen && (
        <div className="space-y-2 rounded-md border border-neutral-200 p-2">
          <Input
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search media files"
          />
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-neutral-500">No files.</p>
          ) : (
            <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => choose(m.id)}
                    title={m.filename}
                    aria-pressed={m.id === value}
                    className={cx(
                      'block w-full overflow-hidden rounded-md border transition-colors hover:border-neutral-900',
                      m.id === value
                        ? 'border-neutral-900 ring-2 ring-neutral-900/30'
                        : 'border-neutral-200'
                    )}
                  >
                    <MediaThumb item={m} className="aspect-square w-full" />
                    <span className="block truncate px-1 py-0.5 text-[10px] text-neutral-500">
                      {m.filename}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
