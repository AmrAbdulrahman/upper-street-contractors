'use client';

/**
 * <ZeroCmsRelationEntry> — wrap a rendered relation. When the related entry is
 * present, it opens the child's own drawer (<ZeroCmsEntry>); otherwise it falls
 * back to the parent field affordance (<ZeroCmsEntryField>).
 */

import type { ReactElement } from 'react';
import { ZeroCmsEntry } from './ZeroCmsEntry';
import { ZeroCmsEntryField } from './ZeroCmsEntryField';
import { type ZeroCmsEntryRef } from './entry-context';

export interface ZeroCmsRelationEntryProps {
  entry: ZeroCmsEntryRef | null | undefined;
  field: string;
  as?: 'div' | 'span';
  children: ReactElement;
}

export function ZeroCmsRelationEntry({
  entry,
  field,
  as,
  children,
}: ZeroCmsRelationEntryProps) {
  if (entry && (entry.id ?? entry.__id)) {
    return <ZeroCmsEntry entry={entry}>{children}</ZeroCmsEntry>;
  }
  return (
    <ZeroCmsEntryField field={field} as={as}>
      {children}
    </ZeroCmsEntryField>
  );
}
