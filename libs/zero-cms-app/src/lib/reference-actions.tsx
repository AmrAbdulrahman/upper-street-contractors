'use client';

/**
 * ReferenceActions — the seam that lets the shared reference field editors
 * (`fields/references`, `components/reference-picker`) open or create the entries
 * they link to, without knowing WHICH surface hosts them.
 *
 * The in-place widget supplies stack-aware actions (push a nested Edit drawer /
 * push a create drawer that resolves the new id on save); the admin app supplies
 * navigation. Both members are optional and act as capability signals:
 *   - `openReference` absent  → reference rows are not click-to-edit.
 *   - `createReference` absent → the "add new <Type>" option is hidden.
 * A bare <EntryForm> outside either surface still renders (null context) and only
 * loses those two affordances.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface ReferenceActions {
  /** Open an existing entry for editing (widget: push a stacked drawer; admin: navigate). */
  openReference?: (id: string, type?: string) => void;
  /**
   * Create a new entry of `type` and resolve its id once the user SAVES it, or
   * `null` if they cancel. Nothing is linked until it resolves (link-on-save).
   */
  createReference?: (type: string) => Promise<string | null>;
}

const ReferenceActionsContext = createContext<ReferenceActions | null>(null);

export function ReferenceActionsProvider({
  value,
  children,
}: {
  value: ReferenceActions;
  children: ReactNode;
}) {
  return (
    <ReferenceActionsContext.Provider value={value}>
      {children}
    </ReferenceActionsContext.Provider>
  );
}

/** Null-safe: returns the injected actions, or null when no surface provides them. */
export function useReferenceActions(): ReferenceActions | null {
  return useContext(ReferenceActionsContext);
}
