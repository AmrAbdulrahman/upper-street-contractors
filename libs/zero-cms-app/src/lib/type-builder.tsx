'use client';

/**
 * Types section: a schema/Type builder. Edits a working copy of the Schema and
 * persists the whole thing via `adapter.saveSchema` (which blocks destructive
 * edits that would invalidate existing entries — surfaced as an error here).
 */

import { useEffect, useState } from 'react';
import type { Field, FieldType, Schema, Type } from '@usc/zero-cms-core';
import { useZeroCms } from './context';
import { Badge, Button, EmptyState, Field as FieldShell, Input, Select, cls, cx } from './components/ui';
import { errorMessage } from './util';

const FIELD_TYPES: FieldType[] = [
  'text',
  'longtext',
  'richtext',
  'blocks',
  'number',
  'json',
  'boolean',
  'asset',
  'lookup',
  'reference',
  'references',
];

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

export function TypeBuilder() {
  const { schema, adapter, refreshSchema } = useZeroCms();
  const [draft, setDraft] = useState<Schema>(schema);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(schema), [schema]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(schema);
  const type: Type | undefined = draft[selected];

  const mutateType = (patch: Partial<Type>) =>
    setDraft((d) => d.map((t, i) => (i === selected ? { ...t, ...patch } : t)));

  const mutateField = (fi: number, next: Field) =>
    mutateType({ fields: type!.fields.map((f, i) => (i === fi ? next : f)) });

  const addType = () => {
    setDraft((d) => [...d, { __name: `type_${d.length + 1}`, fields: [] }]);
    setSelected(draft.length);
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      await adapter.saveSchema(draft);
      await refreshSchema();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex gap-4">
      <aside className="w-48 shrink-0 space-y-1">
        {draft.map((t, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={cx(
              'w-full truncate rounded-md px-3 py-2 text-left text-sm',
              i === selected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'
            )}
          >
            {t.__name}
          </button>
        ))}
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
                <Input
                  value={type.__name}
                  onChange={(e) => mutateType({ __name: e.target.value })}
                />
              </FieldShell>
              <Button
                variant="danger"
                onClick={() => {
                  setDraft((d) => d.filter((_, i) => i !== selected));
                  setSelected(0);
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
          value={field.__type}
          onChange={(e) => onChange(withKind(field, e.target.value as FieldType))}
          className="max-w-40"
        >
          {FIELD_TYPES.map((t) => (
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

      {(field.__type === 'reference' || field.__type === 'references') && (
        <div className="flex flex-wrap gap-2 text-sm text-neutral-600">
          {typeNames.map((tn) => {
            const checked = field.allowedTypes.includes(tn);
            return (
              <label key={tn} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...field,
                      allowedTypes: checked
                        ? field.allowedTypes.filter((x) => x !== tn)
                        : [...field.allowedTypes, tn],
                    })
                  }
                />
                {tn}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
