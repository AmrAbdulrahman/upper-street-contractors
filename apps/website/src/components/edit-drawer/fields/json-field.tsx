"use client";

import { Controller, type Control } from "react-hook-form";
import type { EntryFieldDescriptor } from "@/lib/entry-editor/types";
import {
  FIELD_INPUT_CLASS,
  flatJsonKeys,
  humanizeFieldName,
  isFlatScalarObject,
  jsonIsFlat,
  type FormValues,
} from "../ui";

/**
 * Structured editor for `json` fields. For a flat scalar object (the only shape
 * in this CMS — `site-meta-config.mapLocation` = `{ lat, lon }`) it renders one
 * labelled input per key, with the input type inferred from the current value
 * (number/text/checkbox). Reconstructing the object on save keeps it valid JSON
 * with no parse step. Nested/array values fall back to a raw-JSON textarea.
 */
export function JsonField({
  field,
  control,
  autoFocus,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
  autoFocus?: boolean;
}) {
  const label = humanizeFieldName(field.name);

  // Fallback: nested/array JSON → raw textarea (validated on save in edit-form).
  if (!jsonIsFlat(field.value)) {
    return (
      <Controller
        control={control}
        name={field.name}
        render={({ field: f }) => (
          <textarea
            ref={f.ref}
            name={f.name}
            value={(f.value as string) ?? ""}
            onChange={f.onChange}
            onBlur={f.onBlur}
            rows={6}
            aria-label={label}
            autoFocus={autoFocus}
            className={`${FIELD_INPUT_CLASS} font-mono`}
          />
        )}
      />
    );
  }

  const original = isFlatScalarObject(field.value) ? field.value : {};
  const keys = flatJsonKeys(field.value, field.jsonKeys);

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => {
        const obj = (f.value as Record<string, unknown>) ?? {};
        const update = (key: string, value: unknown) =>
          f.onChange({ ...obj, [key]: value });

        return (
          <div className="space-y-2">
            {keys.map((key, index) => {
              const origValue = original[key];
              const current = obj[key];
              const subLabel = humanizeFieldName(key);

              if (typeof origValue === "boolean") {
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(current)}
                      onChange={(event) => update(key, event.target.checked)}
                      aria-label={subLabel}
                      className="h-4 w-4 accent-gold"
                    />
                    <span className="text-muted">{subLabel}</span>
                  </label>
                );
              }

              const isNumber = typeof origValue === "number";
              return (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs text-muted">
                    {subLabel}
                  </span>
                  <input
                    type={isNumber ? "number" : "text"}
                    step={isNumber ? "any" : undefined}
                    value={current == null ? "" : String(current)}
                    onChange={(event) => update(key, event.target.value)}
                    aria-label={subLabel}
                    autoFocus={autoFocus && index === 0}
                    className={FIELD_INPUT_CLASS}
                  />
                </label>
              );
            })}
          </div>
        );
      }}
    />
  );
}
