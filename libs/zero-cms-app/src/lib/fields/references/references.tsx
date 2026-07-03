'use client';

import { useMemo, type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import type { RendererProps } from '../registry/types';
import { Select, cx } from '../../components/ui';
import { useEntryOptions } from '../entry-options';
import { MultiReferencePicker } from '../../components/reference-picker';

/** One draggable row in a multi-reference list: grab handle, label, remove. */
function SortableReferenceItem({
  id,
  label,
  index,
  onRemove,
}: {
  id: string;
  label: string;
  index: number;
  onRemove: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id, index });
  return (
    <li
      ref={ref}
      className={cx(
        'flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-sm transition-opacity',
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

export const ReferencesRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const allowed = field.__type === 'references' ? field.allowedTypes : [];
  const { options, visual } = useEntryOptions(allowed);
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.id, o.label);
    return m;
  }, [options]);
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => {
        const selected = (f.value as string[]) ?? [];
        if (visual)
          return (
            <MultiReferencePicker
              value={selected}
              onChange={f.onChange}
              options={options}
            />
          );
        const selectedSet = new Set(selected);
        const available = options.filter((o) => !selectedSet.has(o.id));
        const remove = (index: number) =>
          f.onChange(selected.filter((_, i) => i !== index));
        const add = (id: string) => {
          if (id && !selectedSet.has(id)) f.onChange([...selected, id]);
        };
        return (
          <div className="space-y-2">
            {selected.length === 0 ? (
              <p className="text-sm text-neutral-500">None selected.</p>
            ) : (
              // The sortable ids ARE the entry ids, so `move` reorders them directly.
              <DragDropProvider onDragEnd={(event) => f.onChange(move(selected, event))}>
                <ul className="space-y-1">
                  {selected.map((id, index) => (
                    <SortableReferenceItem
                      key={id}
                      id={id}
                      index={index}
                      label={labelById.get(id) ?? id.slice(0, 8)}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </ul>
              </DragDropProvider>
            )}
            <Select value="" onChange={(e) => add(e.target.value)}>
              <option value="">{options.length === 0 ? 'Loading…' : '+ Add…'}</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        );
      }}
    />
  );
};
