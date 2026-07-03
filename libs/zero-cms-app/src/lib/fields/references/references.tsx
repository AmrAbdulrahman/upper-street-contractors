'use client';

import { useMemo, type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import ReactSelect from 'react-select';
import type { RendererProps } from '../registry/types';
import { cls, cx } from '../../components/ui';
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

/** An option in the add dropdown: link an existing entry, or create a new one. */
type AddOption =
  | { kind: 'link'; value: string; label: string }
  | { kind: 'create'; value: string; label: string; ctype: string };

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

        const groups: { label: string; options: AddOption[] }[] = [
          {
            label: 'Link existing',
            options: available.map((o) => ({ kind: 'link', value: o.id, label: o.label })),
          },
        ];
        if (createNew && !atMax && createTypes.length)
          groups.push({
            label: 'Create new',
            options: createTypes.map((c) => ({
              kind: 'create',
              value: `__create:${c.type}`,
              label: `＋ Add new ${c.label}`,
              ctype: c.type,
            })),
          });

        const onPick = (opt: AddOption | null) => {
          if (!opt || atMax) return;
          if (opt.kind === 'create') void createNew?.(opt.ctype);
          else if (!selectedSet.has(opt.value)) f.onChange([...selected, opt.value]);
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
            <ReactSelect<AddOption, false, { label: string; options: AddOption[] }>
              instanceId={field.__name}
              unstyled
              value={null}
              controlShouldRenderValue={false}
              options={groups}
              isDisabled={atMax || (available.length === 0 && !canCreate)}
              placeholder={atMax ? `Maximum of ${max} reached` : options.length || canCreate ? '+ Add…' : 'Loading…'}
              onChange={(opt) => onPick(opt as AddOption | null)}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 2000 }) }}
              classNames={{
                control: (s) =>
                  cx(cls.input, 'flex min-h-[2.5rem] cursor-pointer p-0 pl-1', s.isFocused && 'border-neutral-900 ring-1 ring-neutral-900'),
                valueContainer: () => 'px-2',
                placeholder: () => 'text-neutral-500',
                input: () => 'text-sm text-neutral-900',
                indicatorsContainer: () => 'text-neutral-400',
                dropdownIndicator: () => 'px-2 hover:text-neutral-700',
                indicatorSeparator: () => 'bg-neutral-200',
                menu: () => cx(cls.card, 'mt-1 overflow-hidden shadow-lg'),
                menuList: () => 'max-h-64 py-1',
                group: () => 'py-1',
                groupHeading: () => 'px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400',
                option: (s) =>
                  cx('cursor-pointer px-3 py-2 text-sm', s.isFocused ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700'),
                noOptionsMessage: () => 'px-3 py-2 text-sm text-neutral-500',
              }}
            />
          </div>
        );
      }}
    />
  );
};
