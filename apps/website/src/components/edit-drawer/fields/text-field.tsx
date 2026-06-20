"use client";

import { Controller, type Control } from "react-hook-form";
import type { EntryFieldDescriptor } from "@/lib/entry-editor/types";
import { FIELD_INPUT_CLASS, type FormValues, humanizeFieldName } from "../ui";

export function TextField({
  field,
  control,
  autoFocus,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
  autoFocus?: boolean;
}) {
  const multiline = field.strapiType === "text";
  const label = humanizeFieldName(field.name);

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) =>
        multiline ? (
          <textarea
            ref={f.ref}
            name={f.name}
            value={(f.value as string) ?? ""}
            onChange={f.onChange}
            onBlur={f.onBlur}
            rows={4}
            aria-label={label}
            autoFocus={autoFocus}
            className={FIELD_INPUT_CLASS}
          />
        ) : (
          <input
            ref={f.ref}
            name={f.name}
            type="text"
            value={(f.value as string) ?? ""}
            onChange={f.onChange}
            onBlur={f.onBlur}
            aria-label={label}
            autoFocus={autoFocus}
            className={FIELD_INPUT_CLASS}
          />
        )
      }
    />
  );
}
