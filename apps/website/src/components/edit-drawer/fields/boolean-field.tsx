"use client";

import { Controller, type Control } from "react-hook-form";
import type { EntryFieldDescriptor } from "@/lib/entry-editor/types";
import { type FormValues, humanizeFieldName } from "../ui";

export function BooleanField({
  field,
  control,
  autoFocus,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
  autoFocus?: boolean;
}) {
  const label = humanizeFieldName(field.name);

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => {
        const checked = Boolean(f.value);
        return (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              ref={f.ref}
              name={f.name}
              type="checkbox"
              checked={checked}
              onChange={(event) => f.onChange(event.target.checked)}
              onBlur={f.onBlur}
              aria-label={label}
              autoFocus={autoFocus}
              className="h-4 w-4 accent-gold"
            />
            <span className="text-sm text-muted">{checked ? "On" : "Off"}</span>
          </label>
        );
      }}
    />
  );
}
