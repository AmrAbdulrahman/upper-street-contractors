'use client';

/**
 * The seam that lets a host put a "save as template" button on an entry's hover
 * cluster. A sibling of `duplicate-action-context`, for the same reason: an
 * entry owns exactly one floating cluster, so a host publishes an affordance
 * here rather than mounting a competing overlay.
 *
 * Templates are authored this way and no other. A Template holds `sections`,
 * and the Section builder — the only tool that composes a section list
 * visually — exists on a *rendered page*. A Template has no page, so building
 * one in a drawer would mean assembling a page blind. Snapshotting real content
 * an editor has just built and can see is the same result with no new editing
 * surface at all.
 *
 * `fieldMap` and `shareTypes` come from the host for the reason ADR 0017 gives:
 * which lists belong to a template and which Types are standalone content are
 * facts about *this* content model. A Blog Post gives its `sections`; a Project
 * gives four owned child lists and has no `sections` to give.
 *
 * Absent (the normal case) → an entry shows no template button.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface TemplateActionValue {
  /**
   * The Template kind this entry produces — `blog` | `service` | `project` in
   * the website's model. Stored on the new Template so the right picker offers
   * it back.
   */
  kind: string;
  /**
   * Source field name to Template field name. A Blog Post's `sections` maps to
   * a Template's `sections`; a Project's four child lists map to their
   * namesakes on the Template.
   */
  fieldMap: Record<string, string>;
  /** Types shared rather than copied — see ADR 0017. */
  shareTypes?: readonly string[];
  /**
   * Snapshot THIS entry instead of the one wearing the cluster.
   *
   * For the Services index, where the button sits on a `service-card` but the
   * `sections` worth templating belong to the `page` that card links to. A card
   * has nothing to snapshot on its own.
   */
  sourceId?: string;
  /**
   * A suggested name for the new Template, pre-filled on the new entry. Normally
   * derived from the source's own title.
   */
  suggestedName?: string;
  /** The noun for one item ("post"), so the button's label reads in the host's language. */
  noun: string;
}

const Ctx = createContext<TemplateActionValue | null>(null);

export function TemplateActionProvider({
  value,
  children,
}: {
  value: TemplateActionValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Stops the action leaking past the entry it belongs to — see
 * `DuplicateActionBoundary`, which exists for the identical reason.
 */
export function TemplateActionBoundary({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
}

/** Null-safe: null whenever this entry is not offered as a template source. */
export function useTemplateAction(): TemplateActionValue | null {
  return useContext(Ctx);
}
