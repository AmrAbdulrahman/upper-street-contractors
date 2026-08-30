'use client';

/**
 * The seam that lets a host put a "duplicate" button on an entry's hover cluster.
 *
 * Modelled on `section-slot-context`, and for the same reason: an entry already
 * self-wraps in <ZeroCmsEntry>, which owns the one floating cluster over its
 * corner. A host that wants a second affordance there cannot mount its own
 * overlay — two clusters compete for the same anchor and both fight the
 * hover-keepalive logic — so it publishes the affordance here instead and
 * <ZeroCmsEntry> folds it in beside the pencil.
 *
 * The host must supply the options because ADR 0017 is explicit that
 * `duplicateEntry` does not guess what to share: `shareTypes` is a parameter, not
 * a heuristic, and the list of Types that are standalone content ("a Project has
 * its own URL, a Button is shared site-wide") is knowledge the website has and
 * this library does not.
 *
 * Absent (the normal case) → an entry shows only its edit pencil.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { DuplicateOptions } from '../context';

export interface DuplicateActionValue {
  /** Passed straight to `widget.duplicate` — see ADR 0017. */
  options?: DuplicateOptions;
  /** The noun for one item ("post"), so the button's label reads in the host's language. */
  noun: string;
}

const Ctx = createContext<DuplicateActionValue | null>(null);

export function DuplicateActionProvider({
  value,
  children,
}: {
  value: DuplicateActionValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Stops the action leaking past the entry it belongs to.
 *
 * Context reaches every descendant, so without this a nested <ZeroCmsEntry> — a
 * hero image, a Button inside a card — would offer "Duplicate post" on its own
 * cluster and copy the wrong thing. <ZeroCmsEntry> consumes the value and then
 * renders its children behind this, so exactly one entry per provider claims it.
 */
export function DuplicateActionBoundary({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
}

/** Null-safe: null whenever this entry is not offered as duplicable. */
export function useDuplicateAction(): DuplicateActionValue | null {
  return useContext(Ctx);
}
