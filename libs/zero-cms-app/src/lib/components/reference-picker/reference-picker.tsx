'use client';

/**
 * Visual pickers for `reference` / `references` fields whose target Type carries an
 * image (an `asset` field). Instead of a plain `<Select>` of entry labels, these
 * show the referenced entry's image as a thumbnail — a current-selection preview
 * plus a searchable thumbnail grid, mirroring the {@link AssetPicker} UX. The field
 * value is still the entry id(s); only the presentation changes.
 */

import { useMemo, useState } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { useZeroCms } from '../../context';
import { MediaThumb } from '../media';
import { Button, Input, cx } from '../ui';

export interface RefOption {
  id: string;
  label: string;
  /** Media id of the target entry's image, or null when it has none. */
  mediaId: string | null;
}

/** Resolves a media id to its thumbnail; falls back to a neutral placeholder. */
function OptionThumb({
  mediaId,
  className,
}: {
  mediaId: string | null;
  className?: string;
}) {
  const { media } = useZeroCms();
  const item = mediaId ? media.find((m) => m.id === mediaId) ?? null : null;
  if (!item)
    return (
      <div
        className={cx(
          className,
          'flex items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400'
        )}
      >
        no image
      </div>
    );
  return <MediaThumb item={item} className={className} />;
}

/** Searchable thumbnail grid; calls `onPick(id)` when a cell is chosen. */
function ThumbGrid({
  options,
  selectedId,
  onPick,
}: {
  options: RefOption[];
  selectedId?: string;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;
  return (
    <div className="space-y-2 rounded-md border border-neutral-200 p-2">
      <Input
        placeholder="Search entries…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search entries"
      />
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-500">No entries.</p>
      ) : (
        <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onPick(o.id)}
                title={o.label}
                aria-pressed={o.id === selectedId}
                className={cx(
                  'block w-full overflow-hidden rounded-md border transition-colors hover:border-neutral-900',
                  o.id === selectedId
                    ? 'border-neutral-900 ring-2 ring-neutral-900/30'
                    : 'border-neutral-200'
                )}
              >
                <OptionThumb mediaId={o.mediaId} className="aspect-square w-full" />
                <span className="block truncate px-1 py-0.5 text-[10px] text-neutral-500">
                  {o.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Single-reference picker: preview + thumbnail grid. Value is one entry id ('' = unset). */
export function SingleReferencePicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: RefOption[];
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value) ?? null;
  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      {current ? (
        <div className="flex items-center gap-3">
          <OptionThumb mediaId={current.mediaId} className="h-16 w-16 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
            {current.label}
          </span>
          <Button onClick={() => onChange('')}>Remove</Button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">None selected.</p>
      )}

      <Button onClick={() => setOpen((o) => !o)}>
        {open ? 'Close library' : current ? 'Change…' : 'Choose…'}
      </Button>

      {open && <ThumbGrid options={options} selectedId={value} onPick={choose} />}
    </div>
  );
}

/** One draggable, thumbnailed row in a multi-reference list. */
function SortableRefRow({
  id,
  label,
  mediaId,
  index,
  onRemove,
}: {
  id: string;
  label: string;
  mediaId: string | null;
  index: number;
  onRemove: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id, index });
  return (
    <li
      ref={ref}
      className={cx(
        'flex items-center gap-2 rounded-md border border-neutral-200 p-1.5 text-sm transition-opacity',
        isDragging && 'opacity-60'
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Reorder ${label}`}
        className="shrink-0 cursor-grab touch-none px-0.5 text-neutral-400 hover:text-neutral-900 active:cursor-grabbing"
      >
        ⠿
      </button>
      <OptionThumb mediaId={mediaId} className="h-10 w-10 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-neutral-800">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="rounded border border-neutral-200 px-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100"
      >
        ✕
      </button>
    </li>
  );
}

/** Multi-reference picker: reorderable thumbnail rows + a grid to add more. */
export function MultiReferencePicker({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  options: RefOption[];
}) {
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => {
    const m = new Map<string, RefOption>();
    for (const o of options) m.set(o.id, o);
    return m;
  }, [options]);

  const selectedSet = new Set(value);
  const available = options.filter((o) => !selectedSet.has(o.id));
  const add = (id: string) => {
    if (id && !selectedSet.has(id)) onChange([...value, id]);
  };
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="text-sm text-neutral-500">None selected.</p>
      ) : (
        // The sortable ids ARE the entry ids, so `move` reorders them directly.
        <DragDropProvider onDragEnd={(event) => onChange(move(value, event))}>
          <ul className="space-y-1">
            {value.map((id, index) => {
              const o = byId.get(id);
              return (
                <SortableRefRow
                  key={id}
                  id={id}
                  index={index}
                  label={o?.label ?? id.slice(0, 8)}
                  mediaId={o?.mediaId ?? null}
                  onRemove={() => remove(index)}
                />
              );
            })}
          </ul>
        </DragDropProvider>
      )}

      <Button onClick={() => setOpen((o) => !o)}>
        {open ? 'Close library' : '+ Add…'}
      </Button>

      {open && <ThumbGrid options={available} onPick={add} />}
    </div>
  );
}
