'use client';

import { useRef, useState, type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { Input, Textarea } from '../../components/ui';
import { isFlatScalarObject, type JsonScalar } from '../../json-flat';

/** Raw-JSON textarea for nested/array values (parsed + validated on change). */
function RawJsonEditor({
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

/**
 * Flat scalar object → one labelled input per key, input type inferred from the
 * value captured at mount (number/text/checkbox). The stored value stays a real
 * object (no parse step), so it saves directly.
 */
function FlatJsonEditor({
  value,
  onChange,
}: {
  value: Record<string, JsonScalar>;
  onChange: (v: unknown) => void;
}) {
  // Freeze the key set + per-key type oracle at mount so live edits don't reshape it.
  const originalRef = useRef(value);
  const original = originalRef.current;
  const obj = value ?? {};
  const update = (key: string, v: JsonScalar) => onChange({ ...obj, [key]: v });

  return (
    <div className="space-y-2">
      {Object.keys(original).map((key) => {
        const orig = original[key];
        const current = obj[key];
        const subLabel = key;

        if (typeof orig === 'boolean') {
          return (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(current)}
                onChange={(e) => update(key, e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-neutral-600">{subLabel}</span>
            </label>
          );
        }

        const isNumber = typeof orig === 'number';
        return (
          <label key={key} className="block">
            <span className="mb-1 block text-xs text-neutral-500">{subLabel}</span>
            <Input
              type={isNumber ? 'number' : 'text'}
              step={isNumber ? 'any' : undefined}
              value={current == null ? '' : String(current)}
              onChange={(e) => {
                const raw = e.target.value;
                update(key, isNumber ? (raw === '' ? null : Number(raw)) : raw);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

/** JSON editor: structured key→value inputs for a flat object, else raw JSON. */
function JsonEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  // Pick the mode once from the value at mount so it can't flip while editing.
  const flatRef = useRef(isFlatScalarObject(value));
  if (flatRef.current)
    return (
      <FlatJsonEditor value={value as Record<string, JsonScalar>} onChange={onChange} />
    );
  return <RawJsonEditor value={value} onChange={onChange} />;
}

export const JsonRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => <JsonEditor value={f.value} onChange={f.onChange} />}
  />
);
