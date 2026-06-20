"use client";

import type { EntryFieldDescriptor } from "@/lib/entry-editor/types";

export function UnsupportedField({ field }: { field: EntryFieldDescriptor }) {
  return (
    <p className="text-sm leading-relaxed text-muted">
      Changing a{" "}
      <code className="rounded bg-surface px-1 py-0.5 text-foreground">
        {field.strapiType}
      </code>{" "}
      field is not currently supported. Please open{" "}
      <a
        href={field.cmsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-gold underline hover:text-gold-mid"
      >
        CMS LINK
      </a>{" "}
      to change this field.
    </p>
  );
}
