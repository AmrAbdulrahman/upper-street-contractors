'use client';

/** Accessible slide-over drawer: backdrop, right panel, Esc to close, focus on open.
 *  Stackable: pass `depth` (raises z-index) and `isTop` (only the top panel shows a
 *  scrim, takes focus, and handles Esc; lower panels stay mounted but inert). */

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import {
  getDrawerWide,
  getDrawerWideServer,
  setDrawerWide,
  subscribeDrawerWide,
} from './drawer-width';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** Stack depth (0 = base). Raises z-index so a child layers above its parent. */
  depth?: number;
  /** Topmost panel? Only the top shows the scrim, grabs focus, and handles Esc. */
  isTop?: boolean;
  /**
   * Freeze every way out of this panel — the backdrop click and Esc. Set while
   * the editor inside is writing, because dismissing then unmounts the form the
   * in-flight response is meant to settle into.
   */
  busy?: boolean;
  /**
   * Offer the widen/narrow toggle on this panel. On by default: the width is
   * one shared setting, so a panel that hid the control would still change
   * width under the editor with no way to change it back. The confirm dialogs
   * opt out — they are a paragraph and two buttons, and nothing about them
   * reads better at 64rem.
   */
  resizable?: boolean;
}

/**
 * Two arrows pushing apart (widen) or pulling together (narrow) — the state
 * they lead TO, since the button's job is the change, not the status quo.
 */
function ResizeIcon({ wide }: { wide: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2.5v11" />
      {wide ? (
        // Pulling in towards the divider: the click narrows.
        <path d="M2.5 5l3 3-3 3M13.5 5l-3 3 3 3" />
      ) : (
        // Pushing out from the divider: the click widens.
        <path d="M5.5 5l-3 3 3 3M10.5 5l3 3-3 3" />
      )}
    </svg>
  );
}

export function Drawer({
  open,
  onClose,
  label,
  children,
  depth = 0,
  isTop = true,
  busy = false,
  resizable = true,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const wide = useSyncExternalStore(
    subscribeDrawerWide,
    getDrawerWide,
    getDrawerWideServer
  );

  useEffect(() => {
    if (!open || !isTop || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isTop, busy, onClose]);

  // Focus on open + when isTop flips true (a child popped), so the parent
  // re-grabs focus. Deliberately NOT keyed on `onClose`: hosts pass inline
  // closures whose identity changes every render, and re-running focus() then
  // would yank focus off the field being typed in mid-edit. The contains()
  // guard keeps re-grabs from stealing focus that's already inside the panel.
  useEffect(() => {
    if (!open || !isTop) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    panel.focus();
  }, [open, isTop]);

  if (!open) return null;

  return (
    // Dynamic z-index must be inline — a `z-[${n}]` class isn't scanned by Tailwind's
    // JIT. Base 1300 clears the inspect stack (bar 1000 / header 100 / pencil 90);
    // +10 per depth keeps a child above its parent.
    <div
      className="zero-cms fixed inset-0 flex justify-end"
      style={{ zIndex: 1300 + depth * 10 }}
    >
      {/* Only the top panel renders a scrim; its container sits highest, so this one
          scrim dims every lower panel with no compounding opacity. */}
      {isTop && (
        <button
          aria-label="Close"
          tabIndex={-1}
          disabled={busy}
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default bg-black/40"
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        inert={!isTop}
        // `max-w-[95vw]` on both: the wide width is bigger than a laptop's
        // viewport once a scrollbar is in it, and a panel wider than the screen
        // pushes its own close button off the right-hand edge.
        className={`relative h-full w-full overflow-auto bg-white p-5 text-neutral-900 shadow-2xl outline-none ${
          wide ? 'max-w-[95vw] sm:max-w-[64rem]' : 'max-w-[95vw] sm:max-w-[30rem]'
        }`}
      >
        {resizable && (
          // Top-left, above the breadcrumb: the right-hand side of this row is
          // already the editor's own Close button, and the two would fight.
          <div className="mb-2 flex">
            <button
              type="button"
              aria-pressed={wide}
              title={wide ? 'Narrow drawer' : 'Widen drawer'}
              onClick={() => setDrawerWide(!wide)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            >
              <span className="sr-only">{wide ? 'Narrow drawer' : 'Widen drawer'}</span>
              <ResizeIcon wide={wide} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
