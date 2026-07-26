/**
 * Where the reorder outline has to be scrolled so the grabbed card doesn't move.
 *
 * Collapsing a page's sections from ~900px each to ~78px cards cannot be done in
 * flow: whatever the arrangement, every card but one has to move. Two attempts
 * proved it the hard way —
 *
 *  1. `window.scrollBy(after - before)` on drag start. Broken by scroll
 *     **clamping**: shrinking twenty screens to one drops the maximum scroll
 *     offset far below where the editor was standing, so the offset the
 *     correction needed to restore no longer existed and the page jumped to the
 *     bottom.
 *  2. Reserving the list's height and pushing the collapsed stack down with
 *     `padding-top`. No clamp, and the grabbed card held its place — but
 *     `padding-top` shifts *every* card equally, so the ones above it were shoved
 *     out of position into a cluster below a large blank gap.
 *
 * So the collapse is no longer in flow at all. The list becomes a fixed overlay
 * (an outline over a dimmed page) with a spacer holding the document's height, and
 * this decides the overlay's internal scroll so the grabbed card lands back on the
 * exact pixel it was grabbed from.
 *
 * That pinning is not only cosmetic: dnd-kit caches the **source** element's rect
 * at drag start, so leaving that element's on-screen box alone keeps the cache
 * valid. The other cards are droppables it re-measures itself.
 */

export interface OutlineAnchor {
  /** The overlay's own `top` in the viewport (its fixed gutter). */
  overlayTop: number;
  /** The grabbed card's `offsetTop` inside the overlay's scroll content. */
  cardOffsetTop: number;
  /** Where the grabbed slot sat in the viewport *before* the collapse. */
  anchorViewportTop: number;
  /** The overlay scroller's `scrollHeight`. */
  scrollHeight: number;
  /** The overlay scroller's `clientHeight`. */
  clientHeight: number;
}

export interface OutlineAnchorStyles {
  /** What to set the scroller's `scrollTop` to. */
  scrollTop: number;
  /**
   * Slack to add inside the scroller, at BOTH ends, so `scrollTop` is reachable.
   * A collapsed list is usually shorter than the panel, so its natural scroll
   * range is zero and every anchor would otherwise clamp — see below.
   */
  pad: number;
}

/**
 * A card's viewport top is `overlayTop + cardOffsetTop - scrollTop`, so solving
 * for the scroll that puts it back at `anchorViewportTop` is a subtraction.
 *
 * The subtlety is reachability. Clamping the result to the scroller's existing
 * range looks harmless and is the bug it caused: a collapsed ten-section list is
 * ~780px inside an ~850px panel, so the range is **zero** and every anchor clamps
 * to 0. The card then lands wherever the stack happens to fall — grab a section
 * sitting near the top of the viewport and the pointer ends up hundreds of pixels
 * from the handle it is supposedly holding, for the whole drag. (Moving the cursor
 * to meet the card is not an option: no web API can move the OS pointer.)
 *
 * So instead of clamping to the range, extend the range: pad the scroll content at
 * both ends. The anchor is then always reachable, at the cost of some cards sitting
 * outside the panel — reachable by scrolling, which is what the panel scrolls for.
 * Pinning the handle under the pointer matters more than seeing every card at once:
 * the handle is what the editor is holding.
 *
 * `cardOffsetTop` must be measured with the padding already applied, and the caller
 * still has to correct the result once against a real measurement — a collapsed
 * slot carries a margin that `offsetTop` counts and `getBoundingClientRect` does
 * not, which is worth ~4px, and writing `scrollTop` before the browser has
 * recomputed the padded scroll range silently clamps it.
 */
export function outlineAnchorStyles({
  overlayTop,
  cardOffsetTop,
  anchorViewportTop,
  clientHeight,
}: OutlineAnchor): OutlineAnchorStyles {
  // Equal slack at both ends rather than only what this particular anchor needs.
  // Unconditional is the point: it makes the scroll range independent of which card
  // was grabbed, where a per-anchor pad has to be computed against a range the pad
  // itself changes.
  //
  // `clientHeight + overlayTop` is the smallest amount that provably always works.
  // The panel is inset by the gutter top and bottom, so `clientHeight + 2*overlayTop`
  // is the viewport height, which bounds the anchor; one panel height alone leaves
  // it a gutter short at both extremes (first card grabbed at the very bottom of the
  // viewport, last card grabbed at the very top).
  const pad = Math.max(0, clientHeight + overlayTop);
  return { pad, scrollTop: pad + overlayTop + cardOffsetTop - anchorViewportTop };
}
