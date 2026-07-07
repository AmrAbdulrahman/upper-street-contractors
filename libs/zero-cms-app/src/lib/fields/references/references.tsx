'use client';

import { useMemo, useState, type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import type { RendererProps } from '../registry/types';
import { Button, Input, cx } from '../../components/ui';
import { useZeroCms } from '../../context';
import { useReferenceActions } from '../../reference-actions';
import { useEntryOptions } from '../entry-options';
import { MultiReferencePicker, type RefOption } from '../../components/reference-picker';

/** One draggable row in a multi-reference list: grab handle, click-to-edit label, remove. */
function SortableReferenceItem({
  id,
  label,
  index,
  onRemove,
  onOpen,
  canRemove,
}: {
  id: string;
  label: string;
  index: number;
  onRemove: () => void;
  onOpen?: () => void;
  canRemove: boolean;
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
      {onOpen ? (
        // Right of the handle: opens the child for editing (drag stays on the handle).
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Edit ${label}`}
          className="min-w-0 flex-1 truncate text-left text-neutral-800 hover:text-neutral-900 hover:underline"
        >
          {label}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-neutral-800">{label}</span>
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

/**
 * "+ Add…" control for the plain (non-visual) references editor: a button that
 * toggles a searchable list of linkable entries plus "create new" actions.
 *
 * Its open state is LOCAL and not tied to any input's focus — deliberately NOT a
 * react-select. A react-select menu closes the instant its text input blurs, and the
 * sibling drag-and-drop list (@dnd-kit) steals focus back to a drag handle whenever
 * the control is opened by clicking anywhere but the text input, so the menu flashed
 * open then shut. A plain toggled panel survives that focus churn.
 */
function AddReferenceControl({
  available,
  createTypes,
  canCreate,
  atMax,
  max,
  onLink,
  onCreate,
}: {
  available: RefOption[];
  createTypes: { type: string; label: string }[];
  canCreate: boolean;
  atMax: boolean;
  max?: number;
  onLink: (id: string) => void;
  onCreate: (type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q ? available.filter((o) => o.label.toLowerCase().includes(q)) : available;

  if (atMax) return <p className="text-sm text-neutral-500">Maximum of {max} reached.</p>;

  return (
    <div className="space-y-2">
      <Button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Close' : '+ Add…'}
      </Button>
      {open && (
        <div className="space-y-2 rounded-md border border-neutral-200 p-2">
          {available.length > 0 && (
            <>
              <Input
                placeholder="Search entries…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search entries"
              />
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => onLink(o.id)}
                      className="w-full truncate rounded-md px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-neutral-400">No matches.</li>
                )}
              </ul>
            </>
          )}
          {canCreate &&
            createTypes.map((c) => (
              <Button
                key={c.type}
                onClick={() => onCreate(c.type)}
                className="w-full justify-start"
              >
                ＋ Add new {c.label}
              </Button>
            ))}
          {available.length === 0 && !canCreate && (
            <p className="px-1 py-1 text-sm text-neutral-400">No entries to add.</p>
          )}
        </div>
      )}
    </div>
  );
}

export const ReferencesRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const allowed = field.__type === 'references' ? field.allowedTypes : [];
  const min = field.__type === 'references' ? field.min : undefined;
  const max = field.__type === 'references' ? field.max : undefined;
  const { options, visual, reload } = useEntryOptions(allowed);
  const { schema } = useZeroCms();
  const actions = useReferenceActions();

  const optionById = useMemo(() => {
    const m = new Map<string, RefOption>();
    for (const o of options) m.set(o.id, o);
    return m;
  }, [options]);

  const createTypes = useMemo(
    () => allowed.map((t) => ({ type: t, label: schema.find((s) => s.__name === t)?.label ?? t })),
    [allowed, schema]
  );

  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => {
        const selected = (f.value as string[]) ?? [];
        const atMax = max != null && selected.length >= max;
        const canRemove = selected.length > (min ?? 0);

        const openOne = actions?.openReference
          ? (id: string) => actions.openReference!(id, optionById.get(id)?.type)
          : undefined;
        // Create-on-save: link the new id only once the create drawer resolves it.
        const createNew = actions?.createReference
          ? async (t: string) => {
              const id = await actions.createReference!(t);
              if (id && selected.length < (max ?? Infinity)) f.onChange([...selected, id]);
              reload();
            }
          : undefined;

        if (visual)
          return (
            <MultiReferencePicker
              value={selected}
              onChange={f.onChange}
              options={options}
              onOpen={openOne}
              onCreate={createNew}
              createTypes={createTypes}
              atMax={atMax}
              canRemove={canRemove}
            />
          );

        const selectedSet = new Set(selected);
        const available = options.filter((o) => !selectedSet.has(o.id));
        const remove = (index: number) => {
          if (canRemove) f.onChange(selected.filter((_, i) => i !== index));
        };
        const canCreate = Boolean(createNew && createTypes.length);

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
                      label={optionById.get(id)?.label ?? id.slice(0, 8)}
                      canRemove={canRemove}
                      onRemove={() => remove(index)}
                      onOpen={openOne ? () => openOne(id) : undefined}
                    />
                  ))}
                </ul>
              </DragDropProvider>
            )}
            <AddReferenceControl
              available={available}
              createTypes={createTypes}
              canCreate={canCreate}
              atMax={atMax}
              max={max}
              onLink={(id) => f.onChange([...selected, id])}
              onCreate={(t) => void createNew?.(t)}
            />
          </div>
        );
      }}
    />
  );
};
