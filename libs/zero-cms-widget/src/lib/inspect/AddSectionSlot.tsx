'use client';

/**
 * The dashed "+ Add section" bar the Section builder drops before the first
 * section, between every pair, and after the last one — so a new section is
 * *inserted* where the editor clicked rather than always appended.
 *
 * Distinct from <AddZeroCmsEntry>, which is a small inline chip sized to sit
 * inside a card grid and always appends. This is a full-width row that has to
 * read as a gap in the page.
 *
 * Its palette follows the background it lands on (see `useSurfaceTone`): the same
 * neutral-900 hover that reads as emphasis on a white section made the button
 * invisible on a dark one.
 */

import { useState } from 'react';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry } from './entry-context';
import { useInspect } from './use-inspect';
import { useSurfaceTone } from './use-surface-tone';

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

const TONE = {
  light: [
    'border-neutral-300 bg-white/60 text-neutral-500',
    'hover:border-neutral-900 hover:bg-white hover:text-neutral-900',
    'disabled:border-neutral-200 disabled:bg-transparent disabled:text-neutral-300',
    'disabled:hover:border-neutral-200 disabled:hover:text-neutral-300',
  ].join(' '),
  dark: [
    'border-white/40 bg-white/5 text-white/80',
    'hover:border-white hover:bg-white/15 hover:text-white',
    'disabled:border-white/15 disabled:bg-transparent disabled:text-white/30',
    'disabled:hover:border-white/15 disabled:hover:text-white/30',
  ].join(' '),
} as const;

export function AddSectionSlot({
  field,
  index,
  noun = 'section',
  disabled,
  disabledReason,
}: AddSectionSlotProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const tone = useSurfaceTone(host);
  // `useInspect`, not `widget.inspect`: this adds a row to the page, so showing it
  // before this component has hydrated is a structural mismatch.
  const inspect = useInspect();

  if (!inspect || !widget || !ctx?.entryId || !field) return null;

  return (
    <div ref={setHost} className="zero-cms px-4 py-2">
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
        className={`group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed ${TONE[tone]}`}
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
