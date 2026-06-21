"use client";

import { openEditDrawer } from "@/components/edit-drawer/edit-drawer-store";
import { useState } from "react";
import {
  StrapiEntryProvider,
  type StrapiEntryRef,
  useStrapiEntry,
} from "./strapi-entry-context";
import { useStrapiInspection } from "./strapi-inspection-provider";
import { mergeClassNames, wrapWithStrapiInspect } from "./strapi-inspect-clone";

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

  // Clone the child as the hover host when it's a plain DOM element (preserves
  // structure — e.g. <li>, <section>). For client-component children (Button,
  // ImageContainer) the ref is dropped across the RSC boundary, so wrap them in
  // a host element instead — otherwise no edit affordance ever appears.
  return wrapWithStrapiInspect({
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
