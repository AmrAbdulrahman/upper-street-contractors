'use client';

/**
 * The seam between <ZeroCmsSectionList> and the <ZeroCmsEntry> that each of its
 * items already wraps itself in.
 *
 * The list can't reach into its items to add a remove button — `children` arrive
 * pre-rendered from a Server Component, and each section self-wraps in its own
 * <ZeroCmsEntry> which already owns the floating hover cluster. Rather than bolt
 * a SECOND portaled overlay onto the same corner (two clusters competing for the
 * same anchor, both fighting the hover-keepalive logic), the list publishes the
 * extra affordance here and <ZeroCmsEntry> folds it into the one cluster it
 * already renders — pencil, then trash.
 *
 * The DRAG HANDLE deliberately does NOT come through here. The hover cluster is
 * mounted only while hovered, and hover flips during a drag; an unmounting
 * handle pulls dnd-kit's pointer capture out from under an in-flight drag. The
 * handle is therefore owned by <SectionSlot> itself, where it stays mounted.
 *
 * Absent (the normal case, outside a Section builder) → an entry shows only its
 * edit pencil, exactly as before.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface SectionSlotValue {
  /** Position in the parent's `references` array — for aria text and tests. */
  index: number;
  /** Total sibling count, for "Section 2 of 5" labelling. */
  count: number;
  /** Opens the remove dialog (unlink vs delete). */
  onRemove: () => void;
  /**
   * The noun for one item ("section"), so labels read in the host's language.
   */
  noun: string;
}

const Ctx = createContext<SectionSlotValue | null>(null);

export function SectionSlotProvider({
  value,
  children,
}: {
  value: SectionSlotValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Stops a slot leaking past the entry it belongs to.
 *
 * Context reaches every descendant, so a <ZeroCmsEntry> nested INSIDE a section
 * — a card in a grid, a field in a form — used to read its host section's slot
 * and offer "Remove section 2 of 2" on its own hover cluster. Pressing it
 * unlinked the whole section, from a control that looked like it belonged to
 * the card. <ZeroCmsEntry> consumes the slot and then renders its children
 * behind this, so exactly one entry per slot can ever claim it.
 */
export function SectionSlotBoundary({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
}

/** Null-safe: null whenever this entry is not a slot in a Section builder. */
export function useSectionSlot(): SectionSlotValue | null {
  return useContext(Ctx);
}
