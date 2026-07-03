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
  /** The target entry's Type `__name` (for click-to-edit + option grouping). */
  type: string;
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

/** One draggable, thumbnailed row in a multi-reference list. The thumb+label form a
 *  click target (right of the drag handle) that opens the child for editing. */
function SortableRefRow({
  id,
  label,
  mediaId,
  index,
  onRemove,
  onOpen,
  canRemove = true,
}: {
  id: string;
  label: string;
  mediaId: string | null;
  index: number;
  onRemove: () => void;
  onOpen?: () => void;
  canRemove?: boolean;
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
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Edit ${label}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <OptionThumb mediaId={mediaId} className="h-10 w-10 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-neutral-800 hover:text-neutral-900 hover:underline">
            {label}
          </span>
        </button>
      ) : (
        <>
          <OptionThumb mediaId={mediaId} className="h-10 w-10 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-neutral-800">{label}</span>
        </>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove ${label}`}
        title={canRemove ? undefined : 'Minimum reached'}
        className="rounded border border-neutral-200 px-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        ✕
      </button>
    </li>
  );
}

/** Multi-reference picker: reorderable thumbnail rows + a grid to add more.
 *  `onOpen` makes each row click-to-edit its child; `onCreate`/`createTypes` add a
 *  "＋ Add new <Type>" affordance (link-on-save); `atMax`/`canRemove` enforce limits. */
export function MultiReferencePicker({
  value,
  onChange,
  options,
  onOpen,
  onCreate,
  createTypes = [],
  atMax = false,
  canRemove = true,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  options: RefOption[];
  onOpen?: (id: string) => void;
  onCreate?: (type: string) => void;
  createTypes?: { type: string; label: string }[];
  atMax?: boolean;
  canRemove?: boolean;
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
    if (id && !selectedSet.has(id) && !atMax) onChange([...value, id]);
  };
  const remove = (index: number) => {
    if (canRemove) onChange(value.filter((_, i) => i !== index));
  };

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
                  canRemove={canRemove}
                  onRemove={() => remove(index)}
                  onOpen={onOpen ? () => onOpen(id) : undefined}
                />
              );
            })}
          </ul>
        </DragDropProvider>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setOpen((o) => !o)}
          disabled={atMax && !open}
          title={atMax && !open ? 'Maximum reached' : undefined}
        >
          {open ? 'Close library' : '+ Add…'}
        </Button>
        {onCreate &&
          !atMax &&
          createTypes.map((c) => (
            <Button key={c.type} onClick={() => onCreate(c.type)}>
              ＋ Add new {c.label}
            </Button>
          ))}
      </div>

      {open && <ThumbGrid options={available} onPick={add} />}
    </div>
  );
}
