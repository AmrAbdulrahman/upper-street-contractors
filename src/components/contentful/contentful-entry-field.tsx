"use client";

import { buildContentfulEntryUrl } from "@/lib/contentful/entry-url";
import { useState, type ReactElement } from "react";
import { useContentfulEntry } from "./contentful-entry-context";
import { useContentfulInspection } from "./contentful-inspection-provider";
import {
  ContentfulInspectHost,
  mergeClassNames,
} from "./contentful-inspect-clone";

export type ContentfulEntryFieldProps = {
  /** Contentful field API id to focus in the editor (e.g. `title`, `subtitle`). */
  field: string;
  children: ReactElement;
  /** Merged onto the inspect host (e.g. `min-w-0 flex-1` in flex rows). */
  className?: string;
  /** Host element when wrapping non-DOM children such as `RichText`. */
  as?: "div" | "span";
};

export function ContentfulEntryField({
  field,
  children,
  className,
  as = "div",
}: ContentfulEntryFieldProps) {
  const { enabled, spaceId, environmentId } = useContentfulInspection();
  const entryContext = useContentfulEntry();
  const [hovered, setHovered] = useState(false);

  if (!enabled || !entryContext?.entryId || !spaceId || !field) {
    return children;
  }

  const editUrl = buildContentfulEntryUrl({
    spaceId,
    environmentId,
    entryId: entryContext.entryId,
    focusedField: field,
  });

  const inspectClassName = mergeClassNames(
    "relative isolate outline outline-1 outline-dashed outline-offset-2 transition-[outline-color]",
    "before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:content-['']",
    "before:bg-orange-500/20 before:transition-opacity",
    hovered
      ? "outline-orange-500 before:opacity-100"
      : "outline-transparent before:opacity-0",
  );

  return (
    <ContentfulInspectHost
      as={as}
      className={className}
      inspectClassName={inspectClassName}
      hovered={hovered}
      setHovered={setHovered}
      editUrl={editUrl}
      editAriaLabel={`Edit ${field} in Contentful`}
    >
      {children}
    </ContentfulInspectHost>
  );
}
