"use client";

import { buildContentfulEntryUrl } from "@/lib/contentful/entry-url";
import { useState } from "react";
import {
  ContentfulEntryProvider,
  type ContentfulEntryRef,
  useContentfulEntry,
} from "./contentful-entry-context";
import { useContentfulInspection } from "./contentful-inspection-provider";
import {
  cloneWithContentfulInspect,
  mergeClassNames,
} from "./contentful-inspect-clone";

export type ContentfulEntryProps<T extends ContentfulEntryRef> = {
  entry: T;
  children: React.ReactNode;
  /** Merged onto the root child in inspect mode (e.g. `h-full w-full` in grid cells). */
  className?: string;
};

function ContentfulEntryInspect({
  children,
}: {
  children: React.ReactNode;
}) {
  const { enabled, spaceId, environmentId } = useContentfulInspection();
  const entryContext = useContentfulEntry();
  const [hovered, setHovered] = useState(false);

  const entryId = entryContext?.entryId ?? "";

  if (!enabled || !entryId || !spaceId) {
    return children;
  }

  const editUrl = buildContentfulEntryUrl({
    spaceId,
    environmentId,
    entryId,
  });

  const inspectClassName = mergeClassNames(
    "relative outline outline-2 outline-offset-2 transition-[outline-color]",
    hovered ? "outline-blue-500" : "outline-transparent",
  );

  return cloneWithContentfulInspect({
    children,
    inspectClassName,
    hovered,
    setHovered,
    editUrl,
    editAriaLabel: "Edit entry in Contentful",
  });
}

export function ContentfulEntry<T extends ContentfulEntryRef>({
  entry,
  children,
}: ContentfulEntryProps<T>) {
  return (
    <ContentfulEntryProvider entry={entry}>
      <ContentfulEntryInspect>
        {children}
      </ContentfulEntryInspect>
    </ContentfulEntryProvider>
  );
}
