"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Must match the `card-flash` animation in globals.css. */
const FLASH_MS = 2200;

/** The class globals.css defines; also how the scroll target is found. */
export const CARD_FLASH_CLASS = "card-flash";

/**
 * Marks the card an editor has just created, once they can actually see it.
 *
 * The timing is the whole point. `createFromTemplate` resolves the moment the
 * entry exists — but it then opens the new entry's Edit drawer on top of the
 * grid, so a flash fired there would play out entirely behind a panel and be
 * over before the editor closed it. So the id is held as *pending* and promoted
 * only when the drawer stack closes.
 *
 * Cancelling the drawer still flashes, and should: the entry was created before
 * the drawer opened, so it is on the page either way. Cancelling at the
 * template picker does not, because nothing was created — `createFromTemplate`
 * returns null and nothing is ever marked pending.
 *
 * The scroll target is found by class rather than by ref: a card's `<article>`
 * is cloned by `<ZeroCmsEntry>` rather than rendered directly, so threading a
 * ref down to the real node means changing every card component. One
 * `querySelector` for a class only this hook sets is the cheaper seam.
 */
export function useCardFlash(isDrawerOpen: boolean): {
  /** The entry id to flash, or null. Compare against each card's id. */
  flashId: string | null;
  /** Call with the id a create returned; null/undefined is a no-op. */
  flashOnClose: (id: string | null | undefined) => void;
} {
  // Never read directly — only set, and consumed through the functional updater
  // below, which is what keeps the promote-on-close effect off `pending` as a
  // dependency (it must fire on the drawer's edge, not whenever pending changes).
  const [, setPending] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const sawOpen = useRef(false);

  const flashOnClose = useCallback((id: string | null | undefined) => {
    if (id) setPending(id);
  }, []);

  // Promote pending -> flashing on the drawer's close edge, never on mount:
  // without the `sawOpen` latch this fires immediately, because the stack is
  // already closed when the effect first runs.
  useEffect(() => {
    if (isDrawerOpen) {
      sawOpen.current = true;
      return;
    }
    if (!sawOpen.current) return;
    sawOpen.current = false;
    setPending((id) => {
      if (id) setFlashId(id);
      return null;
    });
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!flashId) return;

    // One frame, so the refreshed grid has painted the new card before we look
    // for it. `scrollIntoView` is guarded because jsdom and older Safari throw
    // on the options object — the same reason the drawer's field highlight
    // wraps its call.
    const raf = requestAnimationFrame(() => {
      try {
        document
          .querySelector(`.${CARD_FLASH_CLASS}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        // A card that cannot be scrolled to is still flashing. Not worth throwing.
      }
    });

    // Cleared so a later `router.refresh()` cannot replay the animation on a
    // card that is no longer new.
    const done = setTimeout(() => setFlashId(null), FLASH_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [flashId]);

  return { flashId, flashOnClose };
}
