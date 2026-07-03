'use client';

/**
 * <ZeroCmsEntry> — wrap a rendered CMS entry. In inspect mode, hovering shows an
 * edit pencil that opens the entry in the widget drawer. Must be used inside
 * <ZeroCmsWidget>.
 */

import { useState, type ReactNode } from 'react';
import { useZeroCmsWidgetOptional } from '../context';
import {
  ZeroCmsEntryProvider,
  useZeroCmsEntry,
  type ZeroCmsEntryRef,
} from './entry-context';
import { mergeClassNames, wrapWithInspect } from './inspect-clone';

export interface ZeroCmsEntryProps {
  entry: ZeroCmsEntryRef;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'span';
}

export function ZeroCmsEntry({ entry, children, className, as }: ZeroCmsEntryProps) {
  return (
    <ZeroCmsEntryProvider entry={entry}>
      <EntryInspect className={className} as={as}>
        {children}
      </EntryInspect>
    </ZeroCmsEntryProvider>
  );
}

function EntryInspect({
  children,
  className,
  as,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'span';
}) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  const [hovered, setHovered] = useState(false);

  const entryId = ctx?.entryId ?? '';
  if (!widget?.inspect || !entryId) return <>{children}</>;
  const { openEntry } = widget;

  const inspectClassName = mergeClassNames(
    'relative outline outline-2 outline-offset-2 transition-[outline-color]',
    hovered ? 'outline-blue-500' : 'outline-transparent'
  );

  return wrapWithInspect({
    children,
    className,
    as,
    inspectClassName,
    hovered,
    setHovered,
    onEdit: () => void openEntry(entryId, { type: ctx?.typeName ?? undefined }),
    editAriaLabel: 'Edit entry',
  });
}
