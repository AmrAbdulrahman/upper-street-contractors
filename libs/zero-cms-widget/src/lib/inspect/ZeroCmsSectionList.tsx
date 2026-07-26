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
import { flushSync } from 'react-dom';
import { DragDropProvider } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';
import { useZeroCmsOptional } from '@usc/zero-cms-app';
import { useZeroCmsWidgetOptional } from '../context';
import { useZeroCmsEntry, entryRefId, entryRefType, type ZeroCmsEntryRef } from './entry-context';
import { useInspect } from './use-inspect';
import { outlineAnchorStyles } from './outline-geometry';
import { AddSectionSlot } from './AddSectionSlot';
import { SectionSlot } from './SectionSlot';
import { RemoveSectionDialog, type RemoveSectionTarget } from './RemoveSectionDialog';
import { useReferencesMeta } from './use-references-meta';

/**
 * `useLayoutEffect` where there is a DOM, `useEffect` where there isn't. This
 * component is server-rendered on every page of the site, and React warns about
 * `useLayoutEffect` during SSR purely for being present — the effect below has to
 * be a layout effect (see its own comment), so the hook itself is swapped instead.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

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

  // `useInspect`, not `widget.inspect` — the wrapper `<div>` this adds is markup the
  // server never sent, and the flag on the context flips before deep subtrees have
  // hydrated. See `useInspect`.
  const inspect = Boolean(useInspect() && parentId);
  const meta = useReferencesMeta(field, inspect);

  /**
   * Set for the duration of a drag. Its presence turns the list into the reorder
   * outline; the two measurements are taken while the list is still expanded and
   * are what let the grabbed card stay on the pixel it was grabbed from.
   */
  const [outline, setOutline] = useState<{
    /** The grabbed slot's id, so the layout effect can find its card. */
    id: string;
    /** The list's height before collapsing — the spacer that replaces it in flow. */
    spacerHeight: number;
    /** Where that slot sat in the viewport before collapsing. */
    anchorViewportTop: number;
  } | null>(null);
  const dragging = outline !== null;
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState<RemoveSectionTarget | null>(null);

  // Reorders are serialised: each `from`/`to` is computed against the optimistic
  // order, which is only the server's order once the previous patch has landed.
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  // The list wrapper — the element that becomes the outline (the scroller). Only
  // mounted in inspect mode; the public path stays a bare fragment.
  const listRef = useRef<HTMLDivElement | null>(null);
  // The scroller's content, which carries the anchor slack. Separate from the
  // scroller because `clientHeight` counts padding.
  const contentRef = useRef<HTMLDivElement | null>(null);

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

  /** True once dnd-kit has actually started a drag, so a plain click can undo the collapse. */
  const dragStarted = useRef(false);

  /**
   * Measure the list as it stands, then open the outline — on pointer-DOWN, not on
   * dnd-kit's drag start.
   *
   * The ordering is the whole point. dnd-kit's default feedback clones the dragged
   * node and positions the clone from a box it measures when the drag activates;
   * collapsing after that gives it a screen-tall snapshot of a section that no
   * longer exists. `flushSync` forces the collapse to commit inside this
   * pointer-down, so by the time dnd-kit measures anything the slot is already the
   * card it will be for the rest of the drag.
   *
   * The measurements themselves are only meaningful before the collapse, which is
   * the other reason they are taken here.
   */
  const openOutline = useCallback((slotId: string) => {
    const list = listRef.current;
    if (!list) return;
    const slot = list.querySelector<HTMLElement>(`[data-zero-cms-slot-id="${slotId}"]`);
    const next = {
      id: slotId,
      spacerHeight: list.offsetHeight,
      // Viewport-relative on purpose: it is where the editor's pointer is, and the
      // overlay it has to match is itself positioned in the viewport.
      anchorViewportTop: slot?.getBoundingClientRect().top ?? 0,
    };
    dragStarted.current = false;
    flushSync(() => setOutline(next));

    // A press that never becomes a drag (a plain click on the handle) gets no
    // `onDragEnd`, so it would leave the page collapsed. One-shot, and it defers
    // to `onDragEnd` whenever a real drag did start.
    const settle = () => {
      if (!dragStarted.current) setOutline(null);
    };
    window.addEventListener('pointerup', settle, { once: true });
    window.addEventListener('pointercancel', settle, { once: true });
  }, []);

  /**
   * Put the grabbed card back under the pointer.
   *
   * A layout effect, not an rAF: this has to land in the same frame the overlay
   * first paints in, or the card is visibly somewhere else for a frame — and that
   * frame is exactly when dnd-kit reads the source rect it caches for the drag.
   */
  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const content = contentRef.current;
    if (!outline) {
      // Drag over: drop everything the anchor needed, or the slack would sit on the
      // resting page as a gap above its first section.
      list.style.height = '';
      if (content) {
        content.style.paddingTop = '';
        content.style.paddingBottom = '';
      }
      return;
    }
    if (!content) return;
    const card = list.querySelector<HTMLElement>(`[data-zero-cms-slot-id="${outline.id}"]`);
    if (!card) return;
    // Height first, from the layout viewport, so `clientHeight` below is a stable
    // number in the same coordinate space as the anchor (see the class comment).
    const gutter = list.getBoundingClientRect().top;
    list.style.height = `${Math.max(0, window.innerHeight - gutter * 2)}px`;
    void list.scrollHeight;

    const { pad, scrollTop } = outlineAnchorStyles({
      // The scroller's own top edge — its fixed gutter. Unaffected by scrollTop,
      // which moves the content inside it, not the box itself.
      overlayTop: gutter,
      // `offsetTop` is relative to the offsetParent, and a `position: fixed`
      // overlay IS the offsetParent for its slots — so this is already the
      // coordinate inside the scroll content that the geometry expects.
      cardOffsetTop: card.offsetTop,
      anchorViewportTop: outline.anchorViewportTop,
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
    });

    // The slack goes on the CONTENT, never on the scroller: `clientHeight` includes
    // an element's own padding, so padding the scroller would inflate the very
    // number the slack is derived from (and with `box-sizing: border-box` it also
    // fights the fixed height, leaving a panel taller than the viewport).
    //
    // It must also be flushed before the scroll: assigning `scrollTop` while the
    // browser still holds the pre-padding scroll range clamps it to the old
    // maximum — which on a short list is 0, i.e. no anchoring at all.
    content.style.paddingTop = `${pad}px`;
    content.style.paddingBottom = `${pad}px`;
    void list.scrollHeight; // forces the layout the assignment below depends on
    list.scrollTop = scrollTop;

    // Then correct against reality, once. `offsetTop` counts the collapsed card's
    // margin and `getBoundingClientRect` doesn't, so the arithmetic alone lands a
    // few pixels out; this closes it without having to model every box quirk.
    const drift = card.getBoundingClientRect().top - outline.anchorViewportTop;
    if (Math.abs(drift) > 0.5) list.scrollTop += drift;
  }, [outline]);

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
        onDragStart={() => {
          // The outline is already open — `onGrab` did it on pointer-down, before
          // dnd-kit measured. This only claims the press so a plain click on the
          // handle doesn't get treated as one (see `openOutline`).
          dragStarted.current = true;
        }}
        onDragEnd={(event) => {
          // Closed before the cancel check, so Escape restores the page too.
          dragStarted.current = false;
          setOutline(null);
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
        {/* Dims the page behind the outline. `pointer-events-none` is load-bearing:
            dnd-kit is tracking pointer events for the whole drag, and a backdrop
            that swallowed them would end the drag the moment it appeared. */}
        {dragging && (
          <div
            aria-hidden
            className="zero-cms pointer-events-none fixed inset-0 z-[800] bg-neutral-950/45"
          />
        )}

        {/* Holds the list's place in the document while it is lifted out of flow,
            so nothing below it moves and the scroll position stays valid. Without
            this the document collapses and the browser clamps scrollY — the
            original bug. */}
        {outline && <div aria-hidden style={{ height: outline.spacerHeight }} />}

        {/* An inspect-only wrapper. Normally a plain passthrough; during a drag it
            becomes the reorder outline — a fixed, viewport-capped, internally
            scrollable panel of collapsed cards. Full-bleed rather than a narrow
            centred panel so the cards keep the width they had in the page, which
            leaves the grabbed card's horizontal box unchanged for dnd-kit.
            The public path above returns the children in a bare fragment and never
            renders any of this. */}
        <div
          ref={listRef}
          data-zero-cms-section-list={field}
          data-zero-cms-outline={dragging ? '' : undefined}
          className={
            dragging
              ? // No height here — the layout effect sets it from `innerHeight`.
                // It has to be a fixed height (a `max-h-` panel is content-sized
                // until it overflows, so the slack would be computed from a
                // `clientHeight` that the slack itself then changes), and it has to
                // come from `innerHeight` rather than `100dvh`: the two disagree in
                // an emulated viewport, and mixing a panel sized in one coordinate
                // space with anchors measured in the other put the card hundreds of
                // pixels out. `innerHeight` is the space the anchors live in, and it
                // already accounts for a mobile URL bar.
                'zero-cms fixed inset-x-0 top-6 z-[810] overflow-y-auto overscroll-contain'
              : undefined
          }
        >
          {/* The scroller's content. It exists to carry the anchor slack, which
              cannot live on the scroller itself: `clientHeight` counts padding, so
              padding the scroller inflates the number the slack is derived from. */}
          <div ref={contentRef}>
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
                    onGrab={() => openOutline(id)}
                  >
                    {slot.node}
                  </SectionSlot>
                  {!dragging && addSlot(i + 1)}
                </Fragment>
              );
            })}
          </div>
        </div>
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
