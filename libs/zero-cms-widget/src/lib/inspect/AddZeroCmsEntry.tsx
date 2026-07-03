'use client';

/**
 * <AddZeroCmsEntry field="buttons"> — placed inside a <ZeroCmsEntry>, renders (in
 * inspect mode) a dashed "+ Add" button that creates a new entry for the parent's
 * `field` relation, links it, and opens its drawer to fill in. Renders nothing
 * outside inspect mode / off a widget, so it's inert on public pages.
 */

import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry } from './entry-context';

export interface AddZeroCmsEntryProps {
  /** The parent's `reference`/`references` field to add the new entry into. */
  field: string;
}

export function AddZeroCmsEntry({ field }: AddZeroCmsEntryProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();

  if (!widget?.inspect || !ctx?.entryId || !field) return null;

  return (
    <button
      type="button"
      aria-label={`Add ${field}`}
      onClick={() =>
        void widget.openCreate({
          parentId: ctx.entryId,
          parentType: ctx.typeName,
          parentField: field,
        })
      }
      className="zero-cms inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900"
    >
      + Add
    </button>
  );
}
