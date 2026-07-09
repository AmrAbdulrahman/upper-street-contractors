"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

const GIZMO_SCRIPT = "https://embed.gizmosauce.com/gs.js";
// Fixed Google Reviews gizmo for Upper Street Contractors.
const GIZMO_APP_CLASS = "gizmo-app-019f4765-cd78-7716-bbfc-8e955ceab8c3";
const GIZMO_HEIGHT = "520";

/**
 * The gizmosauce Google Reviews embed is a carousel whose autoplay reveals each
 * active slide by calling `scrollIntoView()` / `focus()` on it. Because the
 * widget hydrates in the main document (not an iframe), those calls scroll the
 * *window*, yanking the viewport down to the reviews on every autoplay tick.
 *
 * We can't edit the vendor bundle, so we contain it: while any widget instance
 * is mounted, `scrollIntoView`/`focus` calls on nodes *inside the widget* still
 * run natively (the inner review strip advances, real focus lands) but the
 * window scroll they cause is undone immediately. Everything outside the widget
 * — page scrolling, native keyboard Tab, Next's route scroll restoration — is
 * left untouched.
 */

// A node counts as "inside the widget" when any mounted container contains it.
// This set doubles as the install ref-count: patch on 0->1, restore on 1->0.
const containers = new Set<HTMLElement>();

type SavedScrollApis = {
  scrollIntoView: Element["scrollIntoView"];
  focus: HTMLElement["focus"];
  patchedScrollIntoView: Element["scrollIntoView"];
  patchedFocus: HTMLElement["focus"];
};

let saved: SavedScrollApis | null = null;

function insideWidget(node: unknown): boolean {
  // The gizmo carousel lives in a shadow root on the target div, and
  // `Node.contains()` does not pierce shadow boundaries — so a shadow slide is
  // NOT a descendant of our wrapper by that test. Climb shadow hosts so a
  // scroll originating anywhere in the widget's shadow tree still counts.
  let current: Node | null = node instanceof Node ? node : null;
  while (current) {
    for (const container of containers) {
      if (container.contains(current)) return true;
    }
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}

function applyScrollGuards() {
  // Idempotent: multiple instances (and StrictMode's double-invoke) install once.
  if (saved) return;

  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  const nativeFocus = HTMLElement.prototype.focus;
  const nativeScrollTo = window.scrollTo.bind(window);

  const patchedScrollIntoView = function (
    this: Element,
    arg?: boolean | ScrollIntoViewOptions,
  ): void {
    if (!insideWidget(this)) {
      nativeScrollIntoView.call(this, arg);
      return;
    }
    const left = window.scrollX;
    const top = window.scrollY;
    // Reveal inside inner scrollers (instantly), then pin the window back.
    const options: ScrollIntoViewOptions =
      typeof arg === "object" && arg !== null
        ? { ...arg, behavior: "auto" }
        : {
            block: arg === false ? "end" : "start",
            inline: "nearest",
            behavior: "auto",
          };
    nativeScrollIntoView.call(this, options);
    nativeScrollTo({ left, top, behavior: "auto" });
  } as Element["scrollIntoView"];

  const patchedFocus = function (
    this: HTMLElement,
    options?: FocusOptions,
  ): void {
    if (!insideWidget(this)) {
      nativeFocus.call(this, options);
      return;
    }
    const left = window.scrollX;
    const top = window.scrollY;
    nativeFocus.call(this, options);
    nativeScrollTo({ left, top, behavior: "auto" });
  } as HTMLElement["focus"];

  Element.prototype.scrollIntoView = patchedScrollIntoView;
  HTMLElement.prototype.focus = patchedFocus;

  saved = {
    scrollIntoView: nativeScrollIntoView,
    focus: nativeFocus,
    patchedScrollIntoView,
    patchedFocus,
  };
}

function restoreScrollGuards() {
  if (!saved) return;
  // Only restore if nothing else re-patched over us (identity check keeps
  // StrictMode's setup -> cleanup -> setup cycle from stashing a dead closure).
  if (Element.prototype.scrollIntoView === saved.patchedScrollIntoView) {
    Element.prototype.scrollIntoView = saved.scrollIntoView;
  }
  if (HTMLElement.prototype.focus === saved.patchedFocus) {
    HTMLElement.prototype.focus = saved.focus;
  }
  saved = null;
}

type GoogleReviewsWidgetProps = {
  className?: string;
};

/**
 * Google Reviews embed (gizmosauce). The vendor script auto-hydrates any
 * element carrying the `gizmo-app-*` class + `data-gizmo-lazy`, so no explicit
 * load call is needed — mirrors the TrustpilotWidget script+div pattern. The
 * owned wrapper is what we scope the scroll guards to (see above).
 */
export function GoogleReviewsWidget({ className }: GoogleReviewsWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (containers.size === 0) applyScrollGuards();
    containers.add(container);

    return () => {
      containers.delete(container);
      if (containers.size === 0) restoreScrollGuards();
    };
  }, []);

  return (
    <>
      <Script src={GIZMO_SCRIPT} strategy="afterInteractive" />
      {/* Inert wrapper we own — stays valid even if the vendor rewrites its
          target div, and is the containment boundary for the scroll guards. */}
      <div ref={containerRef}>
        <div
          className={[`${GIZMO_APP_CLASS} gizmo-type-google-reviews`, className]
            .filter(Boolean)
            .join(" ")}
          data-gizmo-lazy=""
          data-gizmo-height={GIZMO_HEIGHT}
          data-gizmo-height-desktop={GIZMO_HEIGHT}
          data-gizmo-height-tablet={GIZMO_HEIGHT}
          data-gizmo-height-mobile={GIZMO_HEIGHT}
          suppressHydrationWarning
        />
      </div>
    </>
  );
}
