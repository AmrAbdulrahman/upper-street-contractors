'use client';

/**
 * <ZeroCmsEntry> — wrap a rendered CMS entry. In inspect mode, hovering shows an
 * edit pencil that opens the entry in the widget drawer. Must be used inside
 * <ZeroCmsWidget>.
 *
 * When the entry is also a slot in a <ZeroCmsSectionList>, the same hover cluster
 * grows a drag handle and a remove button (see `section-slot-context`) — one
 * overlay per entry, never two competing for the same corner.
 */

import { useState, type ReactNode } from 'react';
import { useZeroCmsWidgetOptional } from '../context';
import {
  ZeroCmsEntryProvider,
  useZeroCmsEntry,
  type ZeroCmsEntryRef,
} from './entry-context';
import {
  PencilIcon,
  TrashIcon,
  mergeClassNames,
  wrapWithInspect,
  type InspectAction,
} from './inspect-clone';
import { useSectionSlot } from './section-slot-context';

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
  const slot = useSectionSlot();
  const [hovered, setHovered] = useState(false);

  const entryId = ctx?.entryId ?? '';
  if (!widget?.inspect || !entryId) return <>{children}</>;
  const { openEntry } = widget;

  const inspectClassName = mergeClassNames(
    'relative outline outline-2 outline-offset-2 transition-[outline-color]',
    hovered ? 'outline-blue-500' : 'outline-transparent'
  );

  // Edit, then remove when this entry is a Section builder slot. The drag handle
  // is NOT here — see section-slot-context for why it belongs to the slot.
  const where = slot ? ` (${slot.noun} ${slot.index + 1} of ${slot.count})` : '';
  const actions: InspectAction[] = [
    {
      key: 'edit',
      label: `Edit entry${where}`,
      icon: <PencilIcon />,
      onClick: () => void openEntry(entryId, { type: ctx?.typeName ?? undefined }),
    },
    ...(slot
      ? [
          {
            key: 'remove',
            label: `Remove ${slot.noun} ${slot.index + 1} of ${slot.count}`,
            icon: <TrashIcon />,
            onClick: slot.onRemove,
            danger: true,
          } satisfies InspectAction,
        ]
      : []),
  ];

  return wrapWithInspect({ children, className, as, inspectClassName, hovered, setHovered, actions });
}
