/**
 * What a Wizard panel's step body is hiding, and how far the Edge fade has to
 * reach to say so.
 *
 * Pure, so the arithmetic can be reasoned about on its own and the effect that
 * feeds it stays short — the same split `outline-geometry.ts` makes in the
 * widget lib.
 *
 * Content goes out of sight two different ways, and only one of them is the
 * scroller's own `scrollTop`. The Step header and the Step actions are sticky,
 * so once the PAGE has scrolled the panel up they sit over the body's top and
 * bottom — the body is then partly hidden while `scrollTop` is still 0. Reading
 * only the scroll offset leaves that case as a hard chop with no fade at all,
 * which is exactly the moment the affordance is needed.
 */
export type ScrollEdges = {
  /** The body has more content than its own box can show. Drives the keyboard
   *  tab stop, so it deliberately ignores occlusion: a body that fits has no
   *  scroll range, and a tab stop that cannot scroll is a tab stop for nothing. */
  overflowing: boolean;
  /** Something is hidden above the visible band. */
  top: boolean;
  /** Something is hidden below it. */
  bottom: boolean;
  /** How far the mask must reach from the scroller's own top edge: past
   *  whatever the Step header covers, then the fade itself. */
  fadeTop: number;
  fadeBottom: number;
};

/**
 * A pixel of slack at each end. `scrollHeight` and `clientHeight` are rounded
 * integers over a sub-pixel layout, so an exact comparison leaves the bottom
 * fade permanently lit on a body already scrolled to its end.
 */
const SLACK = 1;

/** How far the Edge fade itself reaches, once it starts. */
export const FADE_PX = 28;

export function scrollEdges(box: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** Pixels of the body's top hidden behind the pinned Step header. */
  occludedTop: number;
  /** Pixels of its bottom hidden behind the pinned Step actions. */
  occludedBottom: number;
}): ScrollEdges {
  const max = Math.max(0, box.scrollHeight - box.clientHeight);
  // Never mask more than the box itself, or a panel scrolled almost entirely
  // out of view would ask for a gradient stop past its own height.
  const coveredTop = Math.min(Math.max(0, box.occludedTop), box.clientHeight);
  const coveredBottom = Math.min(
    Math.max(0, box.occludedBottom),
    box.clientHeight - coveredTop,
  );

  const top = box.scrollTop + coveredTop > SLACK;
  const bottom = max - box.scrollTop + coveredBottom > SLACK;

  return {
    overflowing: max > SLACK,
    top,
    bottom,
    fadeTop: top ? coveredTop + FADE_PX : 0,
    fadeBottom: bottom ? coveredBottom + FADE_PX : 0,
  };
}
