'use client';

/**
 * The dashed "+ Add section" bar the Section builder drops before the first
 * section, between every pair, and after the last one — so a new section is
 * *inserted* where the editor clicked rather than always appended.
 *
 * Distinct from <AddZeroCmsEntry>, which is a small inline chip sized to sit
 * inside a card grid and always appends. This is a full-width row that has to
 * read as a gap in the page.
 */

import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry } from './entry-context';

export interface AddSectionSlotProps {
  /** The parent's `references` field to insert into. */
  field: string;
  /** Insert position: 0 = before the first section, n = after the last. */
  index: number;
  /** What one item is called, for the button text and aria-label. */
  noun?: string;
  /** Greyed out and blocked (e.g. the list is at its `max`). */
  disabled?: boolean;
  /** Tooltip shown when disabled. */
  disabledReason?: string;
}

export function AddSectionSlot({
  field,
  index,
  noun = 'section',
  disabled,
  disabledReason,
}: AddSectionSlotProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();

  if (!widget?.inspect || !ctx?.entryId || !field) return null;

  return (
    <div className="zero-cms px-4 py-2">
      <button
        type="button"
        aria-label={`Add ${noun} at position ${index + 1}`}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() =>
          void widget.openCreate({
            parentId: ctx.entryId,
            parentType: ctx.typeName,
            parentField: field,
            atIndex: index,
          })
        }
        className="group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white/60 py-3 text-sm font-medium text-neutral-500 transition-colors hover:border-neutral-900 hover:bg-white hover:text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-transparent disabled:text-neutral-300 disabled:hover:border-neutral-200 disabled:hover:text-neutral-300"
      >
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-base leading-none"
        >
          +
        </span>
        Add {noun}
      </button>
    </div>
  );
}
