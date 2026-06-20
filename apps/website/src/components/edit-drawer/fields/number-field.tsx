"use client";

import { Controller, type Control } from "react-hook-form";
import type { EntryFieldDescriptor } from "@/lib/entry-editor/types";
import { FIELD_INPUT_CLASS, type FormValues, humanizeFieldName } from "../ui";

export function NumberField({
  field,
  control,
  autoFocus,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
  autoFocus?: boolean;
}) {
  const step =
    field.strapiType === "integer" || field.strapiType === "biginteger"
      ? "1"
      : "any";
  const label = humanizeFieldName(field.name);

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => (
        <input
          ref={f.ref}
          name={f.name}
          type="number"
          step={step}
          value={f.value == null ? "" : (f.value as number | string)}
          onChange={(event) => f.onChange(event.target.value)}
          onBlur={f.onBlur}
          aria-label={label}
          autoFocus={autoFocus}
          className={FIELD_INPUT_CLASS}
        />
      )}
    />
  );
}
