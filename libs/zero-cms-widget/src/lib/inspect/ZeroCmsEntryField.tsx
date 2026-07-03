'use client';

/**
 * <ZeroCmsEntryField field="title"> — wrap a single rendered field of a
 * <ZeroCmsEntry>. In inspect mode, hovering shows an edit pencil that opens the
 * entry's drawer with this field scrolled to + highlighted.
 */

import { useState, type ReactElement } from 'react';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry } from './entry-context';
import { InspectHost, mergeClassNames } from './inspect-clone';

export interface ZeroCmsEntryFieldProps {
  field: string;
  children: ReactElement;
  className?: string;
  as?: 'div' | 'span';
}

export function ZeroCmsEntryField({
  field,
  children,
  className,
  as = 'div',
}: ZeroCmsEntryFieldProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  const [hovered, setHovered] = useState(false);

  if (!widget?.inspect || !ctx?.entryId || !field) return children;
  const { openEntry } = widget;

  const inspectClassName = mergeClassNames(
    'relative isolate outline outline-1 outline-dashed outline-offset-2 transition-[outline-color]',
    "before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:content-['']",
    'before:bg-amber-500/20 before:transition-opacity',
    hovered
      ? 'outline-amber-500 before:opacity-100'
      : 'outline-transparent before:opacity-0'
  );

  return (
    <InspectHost
      as={as}
      className={className}
      inspectClassName={inspectClassName}
      hovered={hovered}
      setHovered={setHovered}
      onEdit={() =>
        void openEntry(ctx.entryId, {
          type: ctx.typeName ?? undefined,
          focusField: field,
        })
      }
      editAriaLabel={`Edit ${field}`}
    >
      {children}
    </InspectHost>
  );
}
