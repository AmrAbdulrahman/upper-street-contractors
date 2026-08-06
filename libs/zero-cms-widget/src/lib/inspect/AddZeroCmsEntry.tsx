'use client';

/**
 * <AddZeroCmsEntry field="buttons"> — placed inside a <ZeroCmsEntry>, renders (in
 * inspect mode) a dashed "+ Add" button that creates a new entry for the parent's
 * `field` relation, links it, and opens its drawer to fill in. Renders nothing
 * outside inspect mode / off a widget, so it's inert on public pages.
 *
 * Carries no background of its own, so its palette has to follow the section it
 * lands in (see `useSurfaceTone`) — this is the control that disappeared entirely
 * on dark sections, where `hover:text-neutral-900` on no background meant hovering
 * turned it black-on-navy.
 */

import { useState } from 'react';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry } from './entry-context';
import { useInspect } from './use-inspect';
import { useSurfaceTone } from './use-surface-tone';

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

const TONE = {
  light: [
    'border-neutral-400 text-neutral-600',
    'hover:border-neutral-900 hover:text-neutral-900',
    'disabled:border-neutral-200 disabled:text-neutral-300',
    'disabled:hover:border-neutral-200 disabled:hover:text-neutral-300',
  ].join(' '),
  dark: [
    'border-white/50 text-white/80',
    'hover:border-white hover:bg-white/15 hover:text-white',
    'disabled:border-white/20 disabled:text-white/30',
    'disabled:hover:border-white/20 disabled:hover:text-white/30',
  ].join(' '),
} as const;

export function AddZeroCmsEntry({ field, disabled, disabledReason }: AddZeroCmsEntryProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  const [host, setHost] = useState<HTMLButtonElement | null>(null);
  const tone = useSurfaceTone(host);
  // `useInspect`, not `widget.inspect` — this button is markup the server didn't send.
  const inspect = useInspect();

  if (!inspect || !widget || !ctx?.entryId || !field) return null;

  return (
    <button
      ref={setHost}
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
      className={`zero-cms inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${TONE[tone]}`}
    >
      + Add
    </button>
  );
}
