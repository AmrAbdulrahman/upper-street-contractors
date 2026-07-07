'use client';

/**
 * Types section: a schema/Type builder. Edits a working copy of the Schema and
 * persists the whole thing via `adapter.saveSchema` (which blocks destructive
 * edits that would invalidate existing entries — surfaced as an error here).
 */

import { useEffect, useMemo, useState } from 'react';
import { ZeroCmsError, type Field, type FieldType, type Schema, type Type } from '@usc/zero-cms-core';
import ReactSelect from 'react-select';
import { useZeroCms } from './context';
import { Badge, Button, EmptyState, Field as FieldShell, Input, Select, cls, cx } from './components/ui';
import { SortControl, type SortDir, type SortField } from './list-controls';
import { errorMessage, fuzzyMatch } from './util';

function compareTypesBy(sortBy: SortField, dir: SortDir) {
  const sign = dir === 'asc' ? 1 : -1;
  return (a: Type, b: Type) => {
    if (sortBy === 'created') return sign * (a.__createdAt ?? '').localeCompare(b.__createdAt ?? '');
    if (sortBy === 'updated') return sign * (a.__updatedAt ?? '').localeCompare(b.__updatedAt ?? '');
    return sign * (a.label ?? a.__name).localeCompare(b.label ?? b.__name);
  };
}

/**
 * Field-type picker options. `reference`/`references` are presented as one
 * "relation" kind; a separate cardinality dropdown then chooses One-to-One
 * (`reference`) vs One-to-Many (`references`).
 */
const KIND_OPTIONS = [
  'text',
  'longtext',
  'richtext',
  'blocks',
  'number',
  'json',
  'boolean',
  'date',
  'asset',
  'lookup',
  'relation',
] as const;

function isRelation(field: Field): field is Extract<Field, { allowedTypes: string[] }> {
  return field.__type === 'reference' || field.__type === 'references';
}

/** Reset a field's meta to defaults for a new kind. */
function withKind(field: Field, kind: FieldType): Field {
  const base = { __name: field.__name, label: field.label, required: field.required };
  switch (kind) {
    case 'lookup':
      return { ...base, __type: 'lookup', options: [] };
    case 'asset':
      return { ...base, __type: 'asset', accept: 'any' };
    case 'reference':
      return { ...base, __type: 'reference', allowedTypes: [] };
    case 'references':
      return { ...base, __type: 'references', allowedTypes: [] };
    default:
      return { ...base, __type: kind };
  }
}

/**
 * Toggle a relation field's cardinality, preserving `allowedTypes` (unlike
 * {@link withKind}, which resets them). Narrowing to One-to-One drops min/max.
 */
function withCardinality(field: Field, next: 'reference' | 'references'): Field {
  const base = {
    __name: field.__name,
    label: field.label,
    required: field.required,
    description: field.description,
  };
  const allowedTypes = isRelation(field) ? field.allowedTypes : [];
  if (next === 'references') {
    const min = field.__type === 'references' ? field.min : undefined;
    const max = field.__type === 'references' ? field.max : undefined;
    return {
      ...base,
      __type: 'references',
      allowedTypes,
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
    };
  }
  return { ...base, __type: 'reference', allowedTypes };
}

export function TypeBuilder() {
  const { schema, schemaVersion, adapter, refreshSchema, currentUserId } = useZeroCms();
  const [draft, setDraft] = useState<Schema>(schema);
  // Name-based, not index-based — the sidebar list below is filtered/sorted
  // for display, so an array index can't reliably point at "the selected Type".
  const [selectedName, setSelectedName] = useState<string | undefined>(schema[0]?.__name);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(schema), [schema]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(schema);
  const type: Type | undefined =
    draft.find((t) => t.__name === selectedName) ?? draft[0];

  const visibleTypes = useMemo(() => {
    const q = search.trim();
    const matched = draft.filter(
      (t) => fuzzyMatch(q, t.__name) || fuzzyMatch(q, t.label ?? '')
    );
    return [...matched].sort(compareTypesBy(sortBy, sortDir));
  }, [draft, search, sortBy, sortDir]);

  const mutateType = (patch: Partial<Type>) =>
    setDraft((d) => d.map((t) => (t.__name === type?.__name ? { ...t, ...patch } : t)));

  const renameType = (name: string) => {
    mutateType({ __name: name });
    setSelectedName(name);
  };

  const mutateField = (fi: number, next: Field) =>
    mutateType({ fields: type!.fields.map((f, i) => (i === fi ? next : f)) });

  const addType = () => {
    const name = `type_${draft.length + 1}`;
    setDraft((d) => [...d, { __name: name, fields: [] }]);
    setSelectedName(name);
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      await adapter.saveSchema(draft, currentUserId, schemaVersion);
      await refreshSchema();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
      // A conflict means someone else changed the schema since this was
      // loaded — refresh so `draft` resets to the current version instead of
      // leaving the editor stuck retrying against a version that's gone.
      if (err instanceof ZeroCmsError && err.code === 'CONFLICT') await refreshSchema();
    }
  };

  return (
    <div className="flex gap-4">
      <aside className="w-48 shrink-0 space-y-2">
        <Input
          placeholder="Filter types…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SortControl
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortDir={sortDir}
          onSortDirChange={setSortDir}
        />
        <div className="space-y-1">
          {visibleTypes.map((t) => (
            <button
              key={t.__name}
              onClick={() => setSelectedName(t.__name)}
              className={cx(
                'w-full truncate rounded-md px-3 py-2 text-left text-sm',
                t.__name === type?.__name ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'
              )}
            >
              {t.label ?? t.__name}
            </button>
          ))}
          {visibleTypes.length === 0 && (
            <p className="px-2 text-xs text-neutral-400">No matching types.</p>
          )}
        </div>
        <Button onClick={addType} className="w-full">
          + Type
        </Button>
      </aside>

      <div className="flex-1 space-y-4">
        {!type ? (
          <EmptyState>Add a type to begin.</EmptyState>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <FieldShell label="Type name">
                <Input value={type.__name} onChange={(e) => renameType(e.target.value)} />
              </FieldShell>
              <Button
                variant="danger"
                onClick={() => {
                  const name = type.__name;
                  setDraft((d) => d.filter((t) => t.__name !== name));
                  setSelectedName(draft.find((t) => t.__name !== name)?.__name);
                }}
              >
                Delete type
              </Button>
            </div>

            <div className={cx(cls.card, 'divide-y divide-neutral-100')}>
              {type.fields.map((f, fi) => (
                <FieldRow
                  key={fi}
                  field={f}
                  typeNames={draft.map((t) => t.__name)}
                  onChange={(next) => mutateField(fi, next)}
                  onRemove={() =>
                    mutateType({ fields: type.fields.filter((_, i) => i !== fi) })
                  }
                />
              ))}
              {type.fields.length === 0 && (
                <div className="p-3 text-sm text-neutral-400">No fields yet.</div>
              )}
            </div>

            <Button
              onClick={() =>
                mutateType({
                  fields: [
                    ...type.fields,
                    { __name: `field_${type.fields.length + 1}`, __type: 'text' },
                  ],
                })
              }
            >
              + Field
            </Button>
          </>
        )}

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-neutral-100 pt-3">
          <Button variant="primary" disabled={!dirty} onClick={save}>
            Save schema
          </Button>
          {dirty && <Badge tone="amber">unsaved</Badge>}
          {saved && !dirty && <Badge tone="green">saved</Badge>}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  typeNames,
  onChange,
  onRemove,
}: {
  field: Field;
  typeNames: string[];
  onChange: (next: Field) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={field.__name}
          onChange={(e) => onChange({ ...field, __name: e.target.value })}
          className="max-w-48"
        />
        <Select
          value={isRelation(field) ? 'relation' : field.__type}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === 'relation' ? withKind(field, 'reference') : withKind(field, v as FieldType));
          }}
          className="max-w-40"
        >
          {KIND_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <label className="inline-flex items-center gap-1 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={Boolean(field.required)}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          required
        </label>
        <button
          onClick={onRemove}
          className="ml-auto text-sm text-red-600 hover:underline"
        >
          remove
        </button>
      </div>

      {field.__type === 'lookup' && (
        <Input
          placeholder="Options, comma-separated"
          value={field.options.join(', ')}
          onChange={(e) =>
            onChange({
              ...field,
              options: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      )}

      {field.__type === 'asset' && (
        <Select
          value={field.accept ?? 'any'}
          onChange={(e) =>
            onChange({ ...field, accept: e.target.value as 'image' | 'video' | 'any' })
          }
          className="max-w-40"
        >
          <option value="any">any</option>
          <option value="image">image</option>
          <option value="video">video</option>
        </Select>
      )}

      {field.__type === 'number' && (
        <label className="inline-flex items-center gap-1 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={Boolean(field.integer)}
            onChange={(e) => onChange({ ...field, integer: e.target.checked })}
          />
          integer
        </label>
      )}

      {isRelation(field) && (
        <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Configuration
          </p>

          <FieldShell label="Cardinality">
            <Select
              value={field.__type}
              onChange={(e) =>
                onChange(withCardinality(field, e.target.value as 'reference' | 'references'))
              }
              className="max-w-44"
            >
              <option value="reference">→ One to One</option>
              <option value="references">⇉ One to Many</option>
            </Select>
          </FieldShell>

          <FieldShell label="Allowed types">
            <ReactSelect
              isMulti
              instanceId={`allowed-${field.__name}`}
              unstyled
              aria-label="Allowed types"
              placeholder="Allowed types…"
              options={typeNames.map((tn) => ({ value: tn, label: tn }))}
              value={field.allowedTypes.map((tn) => ({ value: tn, label: tn }))}
              onChange={(opts) => onChange({ ...field, allowedTypes: opts.map((o) => o.value) })}
              classNames={{
                control: (s) =>
                  cx(
                    'flex w-full items-center rounded-md border bg-white px-2 py-1 text-sm transition',
                    s.isFocused ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-300'
                  ),
                valueContainer: () => 'flex flex-wrap gap-1',
                multiValue: () =>
                  'inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700',
                multiValueLabel: () => 'text-neutral-700',
                multiValueRemove: () =>
                  'ml-0.5 cursor-pointer rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800',
                placeholder: () => 'text-neutral-400',
                input: () => 'text-sm text-neutral-900',
                indicatorsContainer: () => 'text-neutral-400',
                dropdownIndicator: () => 'px-1 hover:text-neutral-700',
                clearIndicator: () => 'px-1 hover:text-neutral-700',
                indicatorSeparator: () => 'bg-neutral-200',
                menu: () => 'z-50 mt-1 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg',
                menuList: () => 'py-1',
                option: (s) =>
                  cx(
                    'cursor-pointer px-3 py-2 text-sm',
                    s.isFocused ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700',
                    s.isSelected && 'font-medium'
                  ),
                noOptionsMessage: () => 'px-3 py-2 text-sm text-neutral-400',
              }}
            />
          </FieldShell>

          {field.__type === 'references' && (
            <div className="grid grid-cols-2 gap-3">
              <FieldShell label="Min">
                <Input
                  type="number"
                  value={field.min ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...field,
                      min: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </FieldShell>
              <FieldShell label="Max">
                <Input
                  type="number"
                  value={field.max ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...field,
                      max: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </FieldShell>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
