"use client";

import { openEditDrawer } from "@/components/edit-drawer/edit-drawer-store";
import { useState, type ReactElement } from "react";
import { useStrapiEntry } from "./strapi-entry-context";
import { useStrapiInspection } from "./strapi-inspection-provider";
import {
  StrapiInspectHost,
  mergeClassNames,
} from "./strapi-inspect-clone";

export type StrapiEntryFieldProps = {
  field: string;
  children: ReactElement;
  className?: string;
  as?: "div" | "span";
};

export function StrapiEntryField({
  field,
  children,
  className,
  as = "div",
}: StrapiEntryFieldProps) {
  const { enabled, strapiUrl } = useStrapiInspection();
  const entryContext = useStrapiEntry();
  const [hovered, setHovered] = useState(false);

  if (!enabled || !entryContext?.entryId || !strapiUrl || !field) {
    return children;
  }

  const inspectClassName = mergeClassNames(
    "relative isolate outline outline-1 outline-dashed outline-offset-2 transition-[outline-color]",
    "before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:content-['']",
    "before:bg-orange-500/20 before:transition-opacity",
    hovered
      ? "outline-orange-500 before:opacity-100"
      : "outline-transparent before:opacity-0",
  );

  return (
    <StrapiInspectHost
      as={as}
      className={className}
      inspectClassName={inspectClassName}
      hovered={hovered}
      setHovered={setHovered}
      onEdit={() =>
        openEditDrawer({
          documentId: entryContext.entryId,
          typename: entryContext.typename ?? null,
          focusedField: field,
        })
      }
      editAriaLabel={`Edit ${field} in Strapi`}
    >
      {children}
    </StrapiInspectHost>
  );
}
