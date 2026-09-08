import { useCallback, useRef, type KeyboardEvent } from "react";

/**
 * Keyboard behaviour for a WAI-ARIA tab list: ←/→ step through the tabs, Home
 * and End jump to the ends, and focus follows selection.
 *
 * Shared by the two About-page sections (Story Timeline's year rail and the
 * Value tabs). Both are genuinely tabs — one of N mutually exclusive panels —
 * unlike `projects-view.tsx` / `blog-index-view.tsx`, whose `aria-pressed`
 * buttons are filters. See ADR 0024.
 *
 * Wiring: spread `setRef(i)` onto each tab button's `ref`, put `onKeyDown` on
 * the element carrying `role="tablist"`, and give each button
 * `tabIndex={i === active ? 0 : -1}` so the strip is one tab stop.
 *
 * `wrap` is optional in the ARIA pattern and genuinely varies by content. A set
 * of peer tabs wraps (the default). A chronological rail should not: pressing →
 * on the last year and landing back at the first reads as a bug, and it would
 * disagree with the prev/next arrows beside it, which stop at the ends.
 */
export function useTabListKeys(
  count: number,
  active: number,
  onSelect: (index: number) => void,
  { wrap = true }: { wrap?: boolean } = {}
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const setRef = useCallback(
    (index: number) => (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    []
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (count === 0) return;

      let next: number;
      switch (event.key) {
        case "ArrowRight":
          next = wrap ? (active + 1) % count : Math.min(active + 1, count - 1);
          break;
        case "ArrowLeft":
          next = wrap
            ? (active - 1 + count) % count
            : Math.max(active - 1, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = count - 1;
          break;
        default:
          return;
      }

      // Only now — a bare `preventDefault` above would swallow Tab and PageUp.
      // It still fires at the ends of a non-wrapping list: ← on the first tab
      // must not scroll the page just because selection cannot move.
      event.preventDefault();
      if (next === active) return;
      onSelect(next);
      refs.current[next]?.focus();
    },
    [active, count, onSelect, wrap]
  );

  return { setRef, onKeyDown };
}
