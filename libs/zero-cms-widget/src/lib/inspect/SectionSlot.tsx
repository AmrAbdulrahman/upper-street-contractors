'use client';

/**
 * One sortable slot in a <ZeroCmsSectionList>: the real rendered section, a
 * persistent drag handle, and the compact card it collapses to while a drag is
 * in progress.
 *
 * The handle lives here rather than in <ZeroCmsEntry>'s hover cluster because
 * that cluster only exists while hovered — and hover flips during a drag, which
 * would unmount the element dnd-kit has pointer-captured. This one is mounted
 * for as long as inspect mode is on.
 *
 * While `collapsed`, `children` are unmounted and replaced by the card. That is
 * safe for dnd-kit: the sortable element is this wrapper, which stays put and is
 * simply shorter. It is also the whole point — a post whose sections are each a
 * screen tall is impossible to reorder otherwise.
 */

import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useZeroCmsOptional, typeGlyph } from '@usc/zero-cms-app';
import { mergeClassNames } from './inspect-clone';
import { SectionSlotProvider } from './section-slot-context';

export interface SectionSlotProps {
  /** Entry id — also the sortable id, so `move()` reorders ids directly. */
  id: string;
  index: number;
  count: number;
  /** This section's zero-cms Type `__name`, for the card's glyph + label. */
  typeName: string | null;
  /** True while ANY drag in this list is active. */
  collapsed: boolean;
  onRemove: () => void;
  noun: string;
  children: ReactNode;
}

export function SectionSlot({
  id,
  index,
  count,
  typeName,
  collapsed,
  onRemove,
  noun,
  children,
}: SectionSlotProps) {
  const { ref, handleRef, isDragging } = useSortable({ id, index });
  const zeroCms = useZeroCmsOptional();
  const type = typeName ? zeroCms?.schema.find((t) => t.__name === typeName) : undefined;
  const label = type?.label ?? typeName ?? 'Section';

  return (
    <div
      ref={ref}
      data-zero-cms-section-slot={index}
      className={mergeClassNames(
        'relative',
        isDragging && 'z-10 opacity-80',
        collapsed && 'my-1'
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Reorder ${noun} ${index + 1} of ${count}: ${label}`}
        className="zero-cms absolute left-2 top-2 z-[80] flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md border border-white/20 bg-neutral-900/90 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-neutral-900 active:cursor-grabbing"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          {[8, 12, 16].map((y) =>
            [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />)
          )}
        </svg>
      </button>

      {collapsed ? (
        <div className="zero-cms flex items-center gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3 pl-14 shadow-sm">
          <div className="h-12 w-20 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 p-1.5 text-neutral-400">
            {typeGlyph(type?.thumbnail)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">{label}</p>
            {type?.description ? (
              <p className="truncate text-xs text-neutral-500">{type.description}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <SectionSlotProvider value={{ index, count, onRemove, noun }}>
          {children}
        </SectionSlotProvider>
      )}
    </div>
  );
}
