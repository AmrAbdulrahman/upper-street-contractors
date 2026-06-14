"use client";

import { buildStrapiEntryUrl } from "@/helpers/strapi-entry-url";
import { useRef } from "react";
import { useStrapiEntry } from "./strapi-entry-context";
import { useStrapiInspection } from "./strapi-inspection-provider";
import { type SurfaceTone } from "@/helpers";
import { PlusIcon } from "./plus-icon";
import { useSurfaceTone } from "./use-surface-tone";

const addButtonToneClassNames: Record<SurfaceTone, string> = {
  dark: [
    "border-white/35 text-white",
    "hover:border-whatsapp hover:bg-white/5",
    "active:bg-white/10",
  ].join(" "),
  light: [
    "border-dark/30 text-dark",
    "hover:border-whatsapp hover:bg-dark/5",
    "active:bg-dark/10",
  ].join(" "),
};

export type AddStrapiEntryProps = {
  field: string;
  children?: React.ReactNode;
  className?: string;
};

export function AddStrapiEntry({
  field,
  children,
  className = "",
}: AddStrapiEntryProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { enabled, strapiUrl } = useStrapiInspection();
  const parentEntry = useStrapiEntry();
  const surfaceTone = useSurfaceTone(buttonRef);

  if (!enabled || !parentEntry?.entryId || !strapiUrl || !field) {
    return children ?? null;
  }

  const addUrl = buildStrapiEntryUrl({
    strapiUrl,
    documentId: parentEntry.entryId,
    typename: parentEntry.typename,
    focusedField: field,
  });

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Add entry in Strapi"
      className={[
        "inline-flex h-12 min-w-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-4",
        "border border-dashed bg-transparent text-base font-semibold transition-colors",
        "hover:border-solid",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        addButtonToneClassNames[surfaceTone],
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
