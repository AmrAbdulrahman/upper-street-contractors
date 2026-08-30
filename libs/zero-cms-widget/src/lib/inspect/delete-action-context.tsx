'use client';

/**
 * The seam that lets a host put a "delete" button on an entry's hover cluster.
 *
 * A sibling of `duplicate-action-context` and `template-action-context`, for the
 * same reason: an entry owns exactly one floating cluster, so a host publishes
 * an affordance here rather than mounting a competing overlay.
 *
 * Distinct from a Section builder slot's trash (`section-slot-context`), which
 * offers "remove from the page" first and delete second. A card on an index has
 * no page to be removed from — a Project is queried by Type, not held in any
 * parent's relation field — so the only meaningful action is deleting the entry
 * itself, and the confirm says exactly that.
 *
 * Absent (the normal case) → an entry shows no trash.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface DeleteActionValue {
  /** The noun for one item ("project"), so the button and confirm read in the host's language. */
  noun: string;
  /**
   * This entry's own title, appended to the button's accessible name only.
   *
   * A grid of cards otherwise gives a screen reader "Delete project" once per
   * card with nothing to tell them apart. It stays out of the confirm copy,
   * which names the entry on its own line — a sentence carrying a quoted title
   * mid-clause reads badly and wraps worse.
   */
  label?: string | null;
  /**
   * Called after the entry is gone. The list it was in re-renders on its own
   * (the dialog asks the host to revalidate); this is for hosts that need to go
   * somewhere else, e.g. off the page that entry WAS.
   */
  onDeleted?: (id: string) => void;
}

const Ctx = createContext<DeleteActionValue | null>(null);

export function DeleteActionProvider({
  value,
  children,
}: {
  value: DeleteActionValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Stops the action leaking past the entry it belongs to — see
 * `DuplicateActionBoundary`, which exists for the identical reason. It matters
 * more here than anywhere: a nested entry inheriting this would offer to delete
 * the card it is drawn inside.
 */
export function DeleteActionBoundary({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
}

/** Null-safe: null whenever this entry is not offered as deletable. */
export function useDeleteAction(): DeleteActionValue | null {
  return useContext(Ctx);
}
