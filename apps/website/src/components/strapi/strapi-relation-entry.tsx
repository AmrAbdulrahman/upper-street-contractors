"use client";

import type { ReactElement } from "react";
import { StrapiEntry } from "./strapi-entry";
import type { StrapiEntryRef } from "./strapi-entry-context";
import { StrapiEntryField } from "./strapi-entry-field";

export type StrapiRelationEntryProps = {
  /** The related child entry. When present, hovering opens *its* drawer. */
  entry: StrapiEntryRef | null | undefined;
  /** Parent relation field — used for the "add"/re-point affordance when empty. */
  field: string;
  /** Wrapper element for the empty-state field affordance (inline → "span"). */
  as?: "div" | "span";
  children: ReactElement;
};

/**
 * Render a related child entry so that clicking it opens the *child's* own edit
 * drawer (re-point/edit the related item), not the parent. When the relation is
 * empty there is no child to open, so we fall back to the parent field
 * affordance (which lets you add/attach one via the parent entry).
 *
 * The child element must be a ref-forwarding element (a DOM tag or a
 * forwardRef component like `Button`) because `StrapiEntry` clones it as the
 * hover host.
 */
export function StrapiRelationEntry({
  entry,
  field,
  as,
  children,
}: StrapiRelationEntryProps) {
  if (entry?.documentId) {
    return <StrapiEntry entry={entry}>{children}</StrapiEntry>;
  }
  return (
    <StrapiEntryField field={field} as={as}>
      {children}
    </StrapiEntryField>
  );
}
