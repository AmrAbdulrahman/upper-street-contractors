'use client';

/**
 * <ZeroCmsSectionList> — the Section builder. Wraps a parent entry's ordered
 * `references` field (a page's `sections`, a post's `sections`) and, in inspect
 * mode, makes the list itself editable: insert at any position, remove, and
 * drag to reorder.
 *
 * Every page on this site renders `sections.map(...)` bare, so until this existed
 * an editor could change what a section SAID but never which sections a page HAD.
 *
 * Outside inspect mode it renders `children` verbatim — no wrapper element, no
 * classes, nothing. That is deliberate and load-bearing: this component is wrapped
 * around every page on the site, so a public page must be byte-identical to what
 * it rendered before.
 *
 * RSC note: like <ZeroCmsList>, this takes **pre-rendered `children`** plus a
 * parallel serializable `items` array. Elements serialize across the
 * server→client boundary; render functions do not.
 *
 * Items self-wrap in their own <ZeroCmsEntry>, so this does NOT re-wrap them —
 * it publishes the per-slot remove action through `SectionSlotProvider` and lets
 * that existing hover cluster grow a trash button.
 */

import {
  Children,
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';
import { useZeroCmsOptional } from '@usc/zero-cms-app';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry, entryRefId, entryRefType, type ZeroCmsEntryRef } from './entry-context';
import { AddSectionSlot } from './AddSectionSlot';
import { SectionSlot } from './SectionSlot';
import { RemoveSectionDialog, type RemoveSectionTarget } from './RemoveSectionDialog';
import { useReferencesMeta } from './use-references-meta';

export interface ZeroCmsSectionListProps {
  /** The parent's `references` field these items belong to. */
  field: string;
  /**
   * The items as serializable data (GraphQL/zero-cms entries carrying `id` and
   * `type`), index-aligned with `children`. `type` is what resolves each item's
   * Type label / description / glyph, so select it in your fragments.
   */
  items: ReadonlyArray<unknown>;
  /** Pre-rendered item elements, index-aligned with `items`. */
  children: ReactNode;
  /** What one item is called in the UI. Defaults to `section`. */
  noun?: string;
}

export function ZeroCmsSectionList({
  field,
  items,
  children,
  noun = 'section',
}: ZeroCmsSectionListProps) {
  const widget = useZeroCmsWidgetOptional();
  const ctx = useZeroCmsEntry();
  const zeroCms = useZeroCmsOptional();

  const parentId = ctx?.entryId;
  const inspect = Boolean(widget?.inspect && parentId);
  const meta = useReferencesMeta(field, inspect);

  const [dragging, setDragging] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState<RemoveSectionTarget | null>(null);

  // Reorders are serialised: each `from`/`to` is computed against the optimistic
  // order, which is only the server's order once the previous patch has landed.
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  // Rect of the dragged slot, captured before the list collapses (see below).
  const anchorRect = useRef<{ el: Element; top: number } | null>(null);

  // `items` is deliberately ReadonlyArray<unknown> (the host's GraphQL rows),
  // so narrow once here rather than casting at each use. Nulls are dropped —
  // they keep `items`/`children` aligned but have no id to sort by.
  const childArray = Children.toArray(children);
  const present: Array<{ id: string; entry: ZeroCmsEntryRef; node: ReactNode }> = [];
  items.forEach((item, i) => {
    const node = childArray[i];
    if (item == null || node == null) return;
    const entry = item as ZeroCmsEntryRef;
    const id = entryRefId(entry);
    if (id) present.push({ id, entry, node });
  });

  const ids = present.map((p) => p.id);
  const byId = new Map(present.map((p) => [p.id, p]));
  const order = pendingOrder ?? ids;

  // Any change to the server list (including the one our own reorder caused)
  // retires the optimistic order.
  const idsKey = ids.join(',');
  useEffect(() => setPendingOrder(null), [idsKey]);

  // Collapsing every slot shrinks the document, which slides the section the
  // pointer is holding out from under it. Re-anchor by scrolling the same
  // distance the dragged slot moved — the same correction browser scroll
  // anchoring makes for content inserted above the viewport.
  useLayoutEffect(() => {
    const anchor = anchorRect.current;
    if (!dragging || !anchor) return;
    const delta = anchor.el.getBoundingClientRect().top - anchor.top;
    if (delta) window.scrollBy(0, delta);
    anchorRect.current = null;
  }, [dragging]);

  const openRemove = useCallback(
    (childId: string) => {
      const entry = byId.get(childId)?.entry;
      const childType = entry ? entryRefType(entry) : null;
      const type = childType
        ? zeroCms?.schema.find((t) => t.__name === childType)
        : undefined;
      setRemoving({
        childId,
        childType,
        childLabel: type?.label ?? childType ?? 'This block',
        parentId: parentId!,
        parentType: ctx?.typeName ?? meta.parentType,
        parentField: field,
      });
    },
    [byId, zeroCms, parentId, ctx?.typeName, meta.parentType, field]
  );

  // Public + inspect-off: exactly the children, in a fragment. No wrapper.
  if (!inspect || !widget || !parentId) return <>{children}</>;

  const atMax = meta.max != null && ids.length >= meta.max;
  const addSlot = (index: number) => (
    <AddSectionSlot
      key={`add-${index}`}
      field={field}
      index={index}
      noun={noun}
      disabled={atMax}
      disabledReason={meta.max != null ? `Maximum of ${meta.max} reached` : undefined}
    />
  );

  return (
    <>
      <DragDropProvider
        onDragStart={(event) => {
          const el = (event.operation.source as { element?: Element } | null)?.element;
          if (el) anchorRect.current = { el, top: el.getBoundingClientRect().top };
          setDragging(true);
        }}
        onDragEnd={(event) => {
          setDragging(false);
          anchorRect.current = null;
          if (event.canceled) return;
          const next = move(order, event);
          const id = String(event.operation.source?.id ?? '');
          const from = order.indexOf(id);
          const to = next.indexOf(id);
          if (from < 0 || to < 0 || from === to) return;
          setPendingOrder(next);
          inFlight.current = inFlight.current.then(() =>
            widget.reorder({
              parentId,
              parentType: ctx?.typeName ?? meta.parentType,
              parentField: field,
              from,
              to,
            })
          );
        }}
      >
        {/* Add slots vanish mid-drag: they aren't drop targets, and a row of
            dashed bars shuffling between collapsed cards is pure noise. */}
        {!dragging && addSlot(0)}
        {order.map((id, i) => {
          const slot = byId.get(id);
          if (!slot) return null;
          return (
            <Fragment key={id}>
              <SectionSlot
                id={id}
                index={i}
                count={order.length}
                typeName={entryRefType(slot.entry)}
                collapsed={dragging}
                noun={noun}
                onRemove={() => openRemove(id)}
              >
                {slot.node}
              </SectionSlot>
              {!dragging && addSlot(i + 1)}
            </Fragment>
          );
        })}
      </DragDropProvider>

      {removing && (
        <RemoveSectionDialog
          target={removing}
          noun={noun}
          onDone={() => setRemoving(null)}
        />
      )}
    </>
  );
}
