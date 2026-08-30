'use client';

/**
 * <ZeroCmsEntry> — wrap a rendered CMS entry. In inspect mode, hovering shows an
 * edit pencil that opens the entry in the widget drawer. Must be used inside
 * <ZeroCmsWidget>.
 *
 * When the entry is also a slot in a <ZeroCmsSectionList>, the same hover cluster
 * grows a drag handle and a remove button (see `section-slot-context`) — one
 * overlay per entry, never two competing for the same corner. A host can add a
 * duplicate button the same way (see `duplicate-action-context`), a
 * "save as template" button (see `template-action-context`), or a delete button
 * for an entry that belongs to no page at all (see `delete-action-context`).
 */

import { useState, type ReactNode } from 'react';
import { useZeroCmsWidgetOptional } from '../context';
import {
  ZeroCmsEntryProvider,
  useZeroCmsEntry,
  type ZeroCmsEntryRef,
} from './entry-context';
import {
  DuplicateIcon,
  PencilIcon,
  TemplateIcon,
  TrashIcon,
  mergeClassNames,
  wrapWithInspect,
  type InspectAction,
} from './inspect-clone';
import {
  DuplicateActionBoundary,
  useDuplicateAction,
} from './duplicate-action-context';
import {
  TemplateActionBoundary,
  useTemplateAction,
} from './template-action-context';
import { DeleteActionBoundary, useDeleteAction } from './delete-action-context';
import { DeleteEntryDialog } from './DeleteEntryDialog';
import { SectionSlotBoundary, useSectionSlot } from './section-slot-context';
import { useInspect } from './use-inspect';

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
  const duplicable = useDuplicateAction();
  const templatable = useTemplateAction();
  const deletable = useDeleteAction();
  const [hovered, setHovered] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Not `widget.inspect` — see `useInspect`. The outline classes this adds to the
  // cloned host are a hydration mismatch if they land a frame too early.
  const inspect = useInspect();

  const entryId = ctx?.entryId ?? '';
  // Same boundary on the inactive path: `useInspect` is per-component and
  // hydration-gated, so a nested entry can be live while this one is not yet.
  if (!inspect || !widget || !entryId)
    return (
      <SectionSlotBoundary>
        <DuplicateActionBoundary>
          <TemplateActionBoundary>
            <DeleteActionBoundary>{children}</DeleteActionBoundary>
          </TemplateActionBoundary>
        </DuplicateActionBoundary>
      </SectionSlotBoundary>
    );
  const { openEntry, duplicate, saveAsTemplate } = widget;

  const inspectClassName = mergeClassNames(
    'relative outline outline-2 outline-offset-2 transition-[outline-color]',
    hovered ? 'outline-blue-500' : 'outline-transparent'
  );

  // Edit, then duplicate and save-as-template when a host offers them, then the
  // destructive one last, so the trash never shifts under a pointer aiming at
  // something else. Two different trashes, never both: a Section builder slot
  // removes from the page, a `delete-action` entry belongs to no page and can
  // only be deleted outright. The drag handle
  // is NOT here — see section-slot-context for why it belongs to the slot.
  const where = slot ? ` (${slot.noun} ${slot.index + 1} of ${slot.count})` : '';
  const actions: InspectAction[] = [
    {
      key: 'edit',
      label: `Edit entry${where}`,
      icon: <PencilIcon />,
      onClick: () => void openEntry(entryId, { type: ctx?.typeName ?? undefined }),
    },
    ...(duplicable
      ? [
          {
            key: 'duplicate',
            label: `Duplicate ${duplicable.noun}`,
            icon: <DuplicateIcon />,
            onClick: () => void duplicate(entryId, duplicable.options),
          } satisfies InspectAction,
        ]
      : []),
    ...(templatable
      ? [
          {
            key: 'template',
            label: `Save ${templatable.noun} as a template`,
            icon: <TemplateIcon />,
            onClick: () =>
              // `sourceId` when the host points elsewhere — a Service card's
              // template comes from the page it links to, not from the card.
              void saveAsTemplate(templatable.sourceId ?? entryId, {
                kind: templatable.kind,
                fieldMap: templatable.fieldMap,
                shareTypes: templatable.shareTypes,
                suggestedName: templatable.suggestedName,
              }),
          } satisfies InspectAction,
        ]
      : []),
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
      : deletable
        ? [
            {
              key: 'delete',
              label: deletable.label
                ? `Delete ${deletable.noun} “${deletable.label}”`
                : `Delete ${deletable.noun}`,
              icon: <TrashIcon />,
              onClick: () => setConfirmingDelete(true),
              danger: true,
            } satisfies InspectAction,
          ]
        : []),
  ];

  // The slot is claimed by THIS entry; everything below it is a nested entry
  // (a card, a field) whose own trash must never unlink this section.
  //
  // The boundary goes around the RESULT, not around `children`. `wrapWithInspect`
  // clones a lone host element rather than wrapping it, which is what keeps a
  // grid cell a grid cell — hand it a component element instead and it falls
  // back to an extra <div>, silently breaking every layout on the site. A
  // context provider emits no DOM, so out here it costs nothing. The cluster's
  // remove action is unaffected: `actions` already closed over `slot` above.
  return (
    <SectionSlotBoundary>
      <DuplicateActionBoundary>
        <TemplateActionBoundary>
          <DeleteActionBoundary>
            {wrapWithInspect({
              children,
              className,
              as,
              inspectClassName,
              hovered,
              setHovered,
              actions,
            })}
            {/* A sibling of the wrapped host, not a wrapper around it: cloning
                a lone host element is what keeps a grid cell a grid cell. The
                dialog is `position: fixed`, so even while open it takes no
                cell of its own. */}
            {confirmingDelete && deletable && (
              <DeleteEntryDialog
                entryId={entryId}
                typeName={ctx?.typeName ?? null}
                noun={deletable.noun}
                onDone={() => setConfirmingDelete(false)}
                onDeleted={deletable.onDeleted}
              />
            )}
          </DeleteActionBoundary>
        </TemplateActionBoundary>
      </DuplicateActionBoundary>
    </SectionSlotBoundary>
  );
}
