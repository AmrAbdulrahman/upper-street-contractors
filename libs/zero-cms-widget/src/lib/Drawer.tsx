'use client';

/** Accessible slide-over drawer: backdrop, right panel, Esc to close, focus on open.
 *  Stackable: pass `depth` (raises z-index) and `isTop` (only the top panel shows a
 *  scrim, takes focus, and handles Esc; lower panels stay mounted but inert). */

import { useEffect, useRef, type ReactNode } from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** Stack depth (0 = base). Raises z-index so a child layers above its parent. */
  depth?: number;
  /** Topmost panel? Only the top shows the scrim, grabs focus, and handles Esc. */
  isTop?: boolean;
}

export function Drawer({
  open,
  onClose,
  label,
  children,
  depth = 0,
  isTop = true,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !isTop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isTop, onClose]);

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
        className="relative h-full w-full max-w-[30rem] overflow-auto bg-white p-5 text-neutral-900 shadow-2xl outline-none"
      >
        {children}
      </div>
    </div>
  );
}
