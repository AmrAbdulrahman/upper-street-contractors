"use client";

import { useChangedEntries } from "@/components/edit-drawer/changed-entries-store";
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

  const entryId = entryContext?.entryId ?? "";

  if (!enabled || !entryId || !strapiUrl) {
    return children;
  }

  return (
    <StrapiEntryInspectActive
      entryId={entryId}
      typename={entryContext?.typename ?? null}
    >
      {children}
    </StrapiEntryInspectActive>
  );
}

// Split out so the changed-entries store (which fetches from Strapi) is only
// ever subscribed in inspect mode — never on the live site.
function StrapiEntryInspectActive({
  entryId,
  typename,
  children,
}: {
  entryId: string;
  typename: string | null;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const changed = useChangedEntries();

  // "Not shown on live" = a draft-only entry (no published version).
  const notLive = changed.some(
    (entry) => entry.documentId === entryId && entry.published === false,
  );

  const stateClassName = notLive
    ? "opacity-50 outline-dashed outline-red-500"
    : hovered
      ? "outline-blue-500"
      : "outline-transparent";

  const inspectClassName = mergeClassNames(
    "relative outline outline-2 outline-offset-2 transition-[outline-color,opacity]",
    stateClassName,
  );

  return wrapWithStrapiInspect({
    children,
    inspectClassName,
    hovered,
    setHovered,
    onEdit: () =>
      openEditDrawer({
        documentId: entryId,
        typename,
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
