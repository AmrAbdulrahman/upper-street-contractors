"use client";

import { buildContentfulEntryUrl } from "@/lib/contentful/entry-url";
import { useContentfulEntry } from "./contentful-entry-context";
import { useContentfulInspection } from "./contentful-inspection-provider";
import { PlusIcon } from "./plus-icon";

export type AddContentfulEntryProps = {
  /** Contentful field API id to focus when adding an entry (e.g. `buttons`). */
  field: string;
  children?: React.ReactNode;
  className?: string;
};

export function AddContentfulEntry({
  field,
  children,
  className = "",
}: AddContentfulEntryProps) {
  const { enabled, spaceId, environmentId } = useContentfulInspection();
  const parentEntry = useContentfulEntry();

  if (!enabled || !parentEntry?.entryId || !spaceId || !field) {
    return children ?? null;
  }

  const addUrl = buildContentfulEntryUrl({
    spaceId,
    environmentId,
    entryId: parentEntry.entryId,
    focusedField: field,
  });

  return (
    <button
      type="button"
      aria-label="Add entry in Contentful"
      className={[
        "inline-flex h-12 min-w-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-4",
        "text-base font-semibold transition-colors",
        "border border-dashed border-white/35 bg-transparent text-white",
        "hover:border-solid hover:border-whatsapp hover:bg-white/5",
        "active:bg-white/10",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => {
        window.open(addUrl, "_blank", "noopener,noreferrer");
      }}
    >
      <PlusIcon className="h-5 w-5 shrink-0" />
    </button>
  );
}
