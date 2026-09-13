"use client";

import { useEffect, type RefObject } from "react";

/**
 * The space the Wizard panel is allowed to take, written onto the panel itself.
 *
 * `100dvh` accounts for a phone's URL bar but NOT for its keyboard, and this is
 * a form: focus a text field on iOS and a panel sized in `dvh` keeps its full
 * height behind the keyboard, taking the pinned Step actions down with it — the
 * Next button disappears at the exact moment it matters most. `visualViewport`
 * is the only thing that reports the space actually left on screen.
 *
 * Written to the element via its ref rather than to `documentElement`: the
 * panel is the only consumer, a global would outlive it, and a value that never
 * reaches the server-rendered markup cannot desync on hydration. Until the
 * first measurement lands — and on any browser without the API — the `100dvh`
 * fallback in the calc below stands on its own, so the panel is correctly sized
 * server-side too.
 */
export function usePanelHeight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;

    // `resize` fires on every URL-bar nudge as well as the keyboard, so the
    // write is deferred to the frame rather than done per event.
    let frame = 0;
    const write = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--wizard-vh", `${vv.height}px`);
      });
    };

    write();
    vv.addEventListener("resize", write);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", write);
      el.style.removeProperty("--wizard-vh");
    };
  }, [ref]);
}
