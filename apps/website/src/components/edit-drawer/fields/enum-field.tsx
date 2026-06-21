"use client";

import { Controller, type Control } from "react-hook-form";
import type { EntryFieldDescriptor } from "@/lib/entry-editor/types";
import { FIELD_INPUT_CLASS, type FormValues, humanizeFieldName } from "../ui";

export function EnumField({
  field,
  control,
  autoFocus,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
  autoFocus?: boolean;
}) {
  const label = humanizeFieldName(field.name);
  const options = field.enumOptions ?? [];

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => (
        <select
          ref={f.ref}
          name={f.name}
          value={(f.value as string) ?? ""}
          onChange={f.onChange}
          onBlur={f.onBlur}
          aria-label={label}
          autoFocus={autoFocus}
          className={FIELD_INPUT_CLASS}
        >
          {/* Nullable enum — allow clearing back to no selection. */}
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {humanizeFieldName(option)}
            </option>
          ))}
        </select>
      )}
    />
  );
}
