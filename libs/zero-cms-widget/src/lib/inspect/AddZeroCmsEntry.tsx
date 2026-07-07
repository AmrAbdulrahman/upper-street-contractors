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
  /**
   * Greys out and blocks the button (e.g. when a list is at its `max`). Kept
   * visible so the limit is discoverable rather than the affordance vanishing.
   */
  disabled?: boolean;
  /** Tooltip shown when disabled (e.g. "Maximum of 6 reached"). */
  disabledReason?: string;
}

export function AddZeroCmsEntry({ field, disabled, disabledReason }: AddZeroCmsEntryProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();

  if (!widget?.inspect || !ctx?.entryId || !field) return null;

  return (
    <button
      type="button"
      aria-label={`Add ${field}`}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() =>
        void widget.openCreate({
          parentId: ctx.entryId,
          parentType: ctx.typeName,
          parentField: field,
        })
      }
      className="zero-cms inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300 disabled:hover:border-neutral-200 disabled:hover:text-neutral-300"
    >
      + Add
    </button>
  );
}
