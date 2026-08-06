import { describe, expect, it } from 'vitest';
import { outlineAnchorStyles, type OutlineAnchor } from './outline-geometry';

/**
 * What matters: whatever the grabbed card's place in the list, the scroll that puts
 * it back on the anchor is reachable. Clamping to the scroller's *existing* range
 * was the bug — a collapsed list is usually shorter than the panel, so the range is
 * zero, every anchor clamped to 0, and the pointer spent the whole drag far from the
 * handle it was holding.
 *
 * The caller still corrects this once against a real measurement (see
 * `ZeroCmsSectionList`); what is checked here is the arithmetic and the slack.
 */

/** Where the card ends up, given the styles this returns. */
function cardViewportTop(a: OutlineAnchor) {
  const { scrollTop, pad } = outlineAnchorStyles(a);
  // Padding shifts the content down inside the scroller before it is scrolled.
  return a.overlayTop + pad + a.cardOffsetTop - scrollTop;
}

/** Is that scroll actually reachable once the slack is applied? */
function reachable(a: OutlineAnchor) {
  const { scrollTop, pad } = outlineAnchorStyles(a);
  const max = a.scrollHeight + 2 * pad - a.clientHeight;
  return scrollTop >= 0 && scrollTop <= max;
}

describe('outlineAnchorStyles', () => {
  // Ten sections: ~780px of cards in an ~852px panel — NO natural scroll range.
  const shortList = { overlayTop: 24, scrollHeight: 780, clientHeight: 852 };
  // Twenty-three sections: ~1794px of cards in an 852px panel.
  const longList = { overlayTop: 24, scrollHeight: 1794, clientHeight: 852 };

  it('lands the card on the anchor', () => {
    const a = { ...longList, cardOffsetTop: 546, anchorViewportTop: 300 };
    expect(cardViewportTop(a)).toBe(300);
    expect(reachable(a)).toBe(true);
  });

  it('reserves a panel height plus the gutter as slack at both ends', () => {
    expect(outlineAnchorStyles({ ...longList, cardOffsetTop: 0, anchorViewportTop: 0 }).pad).toBe(876);
  });

  it('stays exact and reachable across every card and grab height', () => {
    // The panel is inset by the gutter top and bottom, so this is the viewport it
    // lives in — and the widest an anchor can be.
    const viewport = (l: { clientHeight: number; overlayTop: number }) =>
      l.clientHeight + 2 * l.overlayTop;
    for (const list of [shortList, longList]) {
      // A card's offset can never exceed the content it sits in.
      for (const cardOffsetTop of [0, 78, 312, 624, list.scrollHeight - 74]) {
        for (const anchorViewportTop of [0, 12, 44, 118, 400, 598, viewport(list)]) {
          const a = { ...list, cardOffsetTop, anchorViewportTop };
          expect(cardViewportTop(a)).toBe(anchorViewportTop);
          expect(reachable(a)).toBe(true);
        }
      }
    }
  });

  it('handles the first card grabbed low in the viewport — nothing above it to scroll past', () => {
    const a = { ...shortList, cardOffsetTop: 0, anchorViewportTop: 700 };
    expect(cardViewportTop(a)).toBe(700);
    expect(reachable(a)).toBe(true);
  });

  it('handles the last card grabbed at the very top of the viewport', () => {
    const a = { ...longList, cardOffsetTop: longList.scrollHeight - 74, anchorViewportTop: 12 };
    expect(cardViewportTop(a)).toBe(12);
    expect(reachable(a)).toBe(true);
  });

  it('never emits negative slack', () => {
    expect(
      outlineAnchorStyles({
        overlayTop: 0, cardOffsetTop: 0, anchorViewportTop: 0, scrollHeight: 0, clientHeight: -10,
      }).pad
    ).toBe(0);
  });
});
