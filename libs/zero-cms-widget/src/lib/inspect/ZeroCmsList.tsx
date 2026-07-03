'use client';

/**
 * <ZeroCmsList> — the reusable wrapper for a "list-like" section: a parent
 * entry's `references` relation rendered as a grid/row of cards. In inspect mode
 * it injects a "+ Add" button (<AddZeroCmsEntry>) plus a per-item remove control,
 * and enforces optional limits — at `max` the add button is disabled, at `min`
 * the remove control is hidden. Outside inspect mode it just renders the items in
 * the given container, so it is inert (and layout-identical) on public pages.
 *
 * RSC note: the host sections are Server Components, so this takes **pre-rendered
 * `children`** (elements serialize across the server→client boundary) plus a
 * serializable `items` array (parallel to the children, used only for entry ids +
 * count). It does NOT take a render function — functions can't cross that boundary.
 *
 * Must live inside the parent's <ZeroCmsEntry> (it reads the parent id/type from
 * context, like <AddZeroCmsEntry>). Items normally self-wrap in their own
 * <ZeroCmsEntry>, so this does NOT re-wrap them — that would double the outline.
 *
 * Remove = unlink: the child is dropped from the parent relation (a draft edit);
 * the entry itself is not deleted and can be re-added. The widget's `unlink`
 * handles the toast + host revalidation.
 */

import { Children, Fragment, useState, type ReactNode } from 'react';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry } from './entry-context';
import { entryRefId, type ZeroCmsEntryRef } from './entry-context';
import { AddZeroCmsEntry } from './AddZeroCmsEntry';

export interface ZeroCmsListProps {
  /** Parent `references` field these items belong to (same value as <AddZeroCmsEntry>). */
  field: string;
  /**
   * The list items as serializable data (zero-cms/GraphQL entries carrying an id),
   * index-aligned with `children`. Used only for entry ids + the min/max count —
   * pass the same array you mapped into `children` (nulls kept for alignment).
   */
  items: ReadonlyArray<unknown>;
  /** Pre-rendered item elements (the section's `items.map(...)`), index-aligned with `items`. */
  children: ReactNode;
  /** Container classes — the grid/flex the section uses to hold the items + add button. */
  className?: string;
  /** Max items: at or above this, "+ Add" is disabled. */
  max?: number;
  /** Min items: at or below this, the per-item remove control is hidden. */
  min?: number;
}

export function ZeroCmsList({
  field,
  items,
  children,
  className,
  max,
  min,
}: ZeroCmsListProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  const [busyId, setBusyId] = useState<string | null>(null);

  const inspect = Boolean(widget?.inspect && ctx?.entryId);
  const childArray = Children.toArray(children);
  const count = items.filter((it) => it != null).length;
  const canRemove = inspect && count > (min ?? 0);
  const atMax = max != null && count >= max;

  // Public + empty: render nothing (no stray empty grid). In inspect, still render
  // the container so the "+ Add" button is available to seed the first item.
  if (!count && !inspect) return null;

  const remove = async (childId: string) => {
    if (!widget || !ctx?.entryId || !childId) return;
    setBusyId(childId);
    try {
      // `unlink` toasts + asks the host to revalidate; it swallows its own errors.
      await widget.unlink({
        parentId: ctx.entryId,
        parentType: ctx.typeName,
        parentField: field,
        childId,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={className}>
      {items.map((item, i) => {
        const node = childArray[i];
        if (item == null || node == null) return null;
        const childId = entryRefId(item as ZeroCmsEntryRef);
        const key = childId || String(i);

        // Public / non-inspect: render the item bare so the DOM matches production.
        if (!inspect) return <Fragment key={key}>{node}</Fragment>;

        return (
          <div key={key} className="relative">
            {node}
            {canRemove && childId && (
              <button
                type="button"
                aria-label="Remove from list"
                title="Remove from this list"
                disabled={busyId === childId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void remove(childId);
                }}
                className="zero-cms absolute left-2 top-2 z-[80] inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600/90 text-base font-bold leading-none text-white shadow transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <AddZeroCmsEntry
        field={field}
        disabled={atMax}
        disabledReason={max != null ? `Maximum of ${max} reached` : undefined}
      />
    </div>
  );
}
