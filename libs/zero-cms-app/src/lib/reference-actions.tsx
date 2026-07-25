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

/**
 * What a Type picker resolved to — create a fresh entry of a Type, or link an
 * existing one. Declared here rather than in zero-cms-widget (which owns the
 * picker UI) because the field editors that consume it live in this library and
 * widget→app is the only legal direction between the two.
 */
export type TypePickResult =
  | { kind: 'create'; type: string }
  | { kind: 'link'; id: string; type: string };

export interface PickReferenceOptions {
  /** The Types the relation field accepts — one cell each. */
  allowedTypes: string[];
  /** The field's human label, for the picker heading. */
  fieldLabel?: string;
  /** Parent entry, when known — only used to count existing usage per candidate. */
  parentId?: string;
  parentType?: string | null;
  parentField?: string;
}

export interface ReferenceActions {
  /** Open an existing entry for editing (widget: push a stacked drawer; admin: navigate). */
  openReference?: (id: string, type?: string) => void;
  /**
   * Create a new entry of `type` and resolve its id once the user SAVES it, or
   * `null` if they cancel. Nothing is linked until it resolves (link-on-save).
   */
  createReference?: (type: string) => Promise<string | null>;
  /**
   * Ask the editor WHICH Type to add (or which existing entry to reuse), via the
   * host's Type picker.
   *
   * Without this, a field editor has to offer one "add new <Type>" button per
   * allowed Type — which is fine for two or three and unusable for a page's
   * `sections`, where it rendered a wall of 23 buttons. Present ⇒ the editor
   * shows a single "+ Add…" and lets the picker do the choosing.
   */
  pickReference?: (opts: PickReferenceOptions) => Promise<TypePickResult | null>;
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
