'use client';

/**
 * Field renderer registry keyed by `__type` (the in-place + full-form editing
 * surface). Each renderer is wired to react-hook-form via Controller. Reference
 * and asset pickers pull their options from the Adapter / media library through
 * context. Rich text is the pluggable editor from context.
 */

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Controller,
  useForm,
  type Control,
  type DefaultValues,
} from 'react-hook-form';
import type { Field, FieldType, Type, OutputEntry } from '@usc/zero-cms-core';
import { BlocksEditor } from '@usc/zero-cms-blocks';
import { useZeroCms } from './context';
import { Button, Field as FieldShell, Input, Select, Textarea, cls, cx } from './ui';

export type FormValues = Record<string, unknown>;

interface RendererProps {
  field: Field;
  control: Control<FormValues>;
}

const labelOf = (f: Field) => f.label ?? f.__name;

/** First text-ish field of a Type, used to label entries in pickers/lists. */
export function titleField(type: Type): string | undefined {
  return type.fields.find((f) =>
    ['text', 'longtext'].includes(f.__type)
  )?.__name;
}

export function entryLabel(type: Type | undefined, entry: OutputEntry): string {
  const tf = type && titleField(type);
  const v = tf ? entry[tf] : undefined;
  return typeof v === 'string' && v ? v : entry.__id.slice(0, 8);
}

/** Load entries of the allowed target types as { id, label } picker options. */
function useEntryOptions(allowedTypes: string[]) {
  const { adapter, schema } = useZeroCms();
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const key = allowedTypes.join(',');
  useEffect(() => {
    let live = true;
    void (async () => {
      const all: { id: string; label: string }[] = [];
      for (const tn of allowedTypes) {
        const type = schema.find((t) => t.__name === tn);
        const { data } = await adapter.query(tn, {
          status: 'draft',
          includeUnpublished: true,
        });
        for (const e of data) all.push({ id: e.__id, label: entryLabel(type, e) });
      }
      if (live) setOptions(all);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, adapter, schema]);
  return options;
}

const TextRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <Input value={(f.value as string) ?? ''} onChange={f.onChange} onBlur={f.onBlur} />
    )}
  />
);

const LongTextRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <Textarea value={(f.value as string) ?? ''} onChange={f.onChange} onBlur={f.onBlur} />
    )}
  />
);

const RichTextRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const { RichText } = useZeroCms();
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <RichText value={(f.value as string) ?? ''} onChange={f.onChange} />
      )}
    />
  );
};

const NumberRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <Input
        type="number"
        value={f.value === '' || f.value == null ? '' : String(f.value)}
        step={field.__type === 'number' && field.integer ? 1 : 'any'}
        onChange={(e) => {
          const v = e.target.value;
          f.onChange(v === '' ? '' : Number(v));
        }}
        onBlur={f.onBlur}
      />
    )}
  />
);

/** JSON / blocks editor: a JSON textarea (a structured blocks editor comes later). */
function JsonEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    value == null || value === '' ? '' : JSON.stringify(value, null, 2)
  );
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Textarea
        className="min-h-32 font-mono text-xs"
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t.trim() === '') {
            onChange('');
            setErr(null);
            return;
          }
          try {
            onChange(JSON.parse(t));
            setErr(null);
          } catch {
            setErr('Invalid JSON');
          }
        }}
      />
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

const JsonRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => <JsonEditor value={f.value} onChange={f.onChange} />}
  />
);

const BlocksFieldRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => <BlocksEditor value={f.value} onChange={f.onChange} />}
  />
);

const BooleanRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-neutral-300"
          checked={Boolean(f.value)}
          onChange={(e) => f.onChange(e.target.checked)}
        />
        <span className="text-neutral-600">{labelOf(field)}</span>
      </label>
    )}
  />
);

const LookupRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const options = field.__type === 'lookup' ? field.options : [];
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <Select value={(f.value as string) ?? ''} onChange={f.onChange}>
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      )}
    />
  );
};

const AssetRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const { media } = useZeroCms();
  const accept = field.__type === 'asset' ? field.accept ?? 'any' : 'any';
  const pool = media.filter((m) => accept === 'any' || m.kind === accept);
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <Select value={(f.value as string) ?? ''} onChange={f.onChange}>
          <option value="">— no media —</option>
          {pool.map((m) => (
            <option key={m.id} value={m.id}>
              {m.filename}
            </option>
          ))}
        </Select>
      )}
    />
  );
};

const ReferenceRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const allowed = field.__type === 'reference' ? field.allowedTypes : [];
  const options = useEntryOptions(allowed);
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <Select value={(f.value as string) ?? ''} onChange={f.onChange}>
          <option value="">— none —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    />
  );
};

const ReferencesRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const allowed = field.__type === 'references' ? field.allowedTypes : [];
  const options = useEntryOptions(allowed);
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => {
        const selected = new Set((f.value as string[]) ?? []);
        const toggle = (id: string) => {
          const next = new Set(selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          f.onChange([...next]);
        };
        return (
          <div className={cx(cls.input, 'max-h-40 space-y-1 overflow-auto')}>
            {options.length === 0 && (
              <span className="text-xs text-neutral-400">No entries</span>
            )}
            {options.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                />
                {o.label}
              </label>
            ))}
          </div>
        );
      }}
    />
  );
};

export const fieldRegistry: Record<FieldType, ComponentType<RendererProps>> = {
  text: TextRenderer,
  longtext: LongTextRenderer,
  richtext: RichTextRenderer,
  blocks: BlocksFieldRenderer,
  number: NumberRenderer,
  json: JsonRenderer,
  boolean: BooleanRenderer,
  lookup: LookupRenderer,
  asset: AssetRenderer,
  reference: ReferenceRenderer,
  references: ReferencesRenderer,
};

function FieldControl({ field, control }: RendererProps) {
  const Renderer = fieldRegistry[field.__type];
  if (field.__type === 'boolean')
    return <Renderer field={field} control={control} />;
  return (
    <FieldShell label={labelOf(field)} required={field.required}>
      <Renderer field={field} control={control} />
    </FieldShell>
  );
}

/** Scrolls into view + glows when this is the focused field (in-place edit). */
function FieldHighlight({
  highlighted,
  children,
}: {
  highlighted: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlighted) return;
    try {
      ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* scrollIntoView is unavailable in jsdom / SSR */
    }
  }, [highlighted]);
  return (
    <div
      ref={ref}
      className={cx(
        'rounded-md p-1 transition',
        highlighted && 'ring-2 ring-amber-400 ring-offset-2'
      )}
    >
      {children}
    </div>
  );
}

export interface EntryFormProps {
  type: Type;
  defaultValues: FormValues;
  onSubmit: (values: FormValues) => void | Promise<void>;
  submitLabel?: string;
  footer?: React.ReactNode;
  /** Field `__name` to scroll to + highlight (in-place edit from the widget). */
  focusField?: string;
}

export function EntryForm({
  type,
  defaultValues,
  onSubmit,
  submitLabel = 'Save draft',
  footer,
  focusField,
}: EntryFormProps) {
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: defaultValues as DefaultValues<FormValues>,
  });

  // Reset when the edited entry changes.
  const key = useMemo(() => JSON.stringify(defaultValues), [defaultValues]);
  useEffect(() => {
    reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {type.fields.map((f) => (
        <FieldHighlight key={f.__name} highlighted={f.__name === focusField}>
          <FieldControl field={f} control={control} />
        </FieldHighlight>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  );
}
