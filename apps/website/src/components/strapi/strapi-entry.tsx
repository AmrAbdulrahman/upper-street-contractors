"use client";

import { openEditDrawer } from "@/components/edit-drawer/edit-drawer-store";
import { useState } from "react";
import {
  StrapiEntryProvider,
  type StrapiEntryRef,
  useStrapiEntry,
} from "./strapi-entry-context";
import { useStrapiInspection } from "./strapi-inspection-provider";
import {
  cloneWithStrapiInspect,
  mergeClassNames,
} from "./strapi-inspect-clone";

export type StrapiEntryProps<T extends StrapiEntryRef> = {
  entry: T;
  children: React.ReactNode;
  className?: string;
};

function StrapiEntryInspect({
  children,
}: {
  children: React.ReactNode;
}) {
  const { enabled, strapiUrl } = useStrapiInspection();
  const entryContext = useStrapiEntry();
  const [hovered, setHovered] = useState(false);

  const entryId = entryContext?.entryId ?? "";

  if (!enabled || !entryId || !strapiUrl) {
    return children;
  }

  const inspectClassName = mergeClassNames(
    "relative outline outline-2 outline-offset-2 transition-[outline-color]",
    hovered ? "outline-blue-500" : "outline-transparent",
  );

  return cloneWithStrapiInspect({
    children,
    inspectClassName,
    hovered,
    setHovered,
    onEdit: () =>
      openEditDrawer({
        documentId: entryId,
        typename: entryContext?.typename ?? null,
        focusedField: null,
      }),
    editAriaLabel: "Edit entry in Strapi",
  });
}

export function StrapiEntry<T extends StrapiEntryRef>({
  entry,
  children,
}: StrapiEntryProps<T>) {
  return (
    <StrapiEntryProvider entry={entry}>
      <StrapiEntryInspect>{children}</StrapiEntryInspect>
    </StrapiEntryProvider>
  );
}
