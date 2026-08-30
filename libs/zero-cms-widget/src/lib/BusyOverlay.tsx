'use client';

/**
 * A blocking, full-screen "this is working" scrim.
 *
 * Blocking is the feature, not a side effect. Duplicating an entry is N
 * sequential creates (ADR 0017) — seconds of silence during which the button
 * that started it is still live, and a second click makes a second copy. The
 * scrim swallows those clicks.
 *
 * Mounts nothing for the first {@link SHOW_AFTER_MS}. An action that finishes
 * quickly must not flash a scrim — the flash reads as a fault, and it is more
 * distracting than the silence it replaces.
 *
 * There is a second, near-identical copy of this in the website app. That is
 * deliberate: the enquiry wizard is a public-page leaf, and importing anything
 * from this package there would pull the whole CMS widget into the bundle every
 * anonymous visitor downloads.
 */

import { useEffect, useState } from 'react';

const SHOW_AFTER_MS = 150;

export interface BusyOverlayProps {
  /** Whether the action is in flight. */
  show: boolean;
  /** What is happening, in the present tense — "Duplicating post…". */
  label: string;
}

export function BusyOverlay({ show, label }: BusyOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, [show]);

  if (!show || !visible) return null;

  return (
    <div
      // Above the bar (z-1000) and the drawer stack (z-1300+): whatever is
      // running was started from one of them, and half a blocked screen is
      // worse than none.
      className="zero-cms fixed inset-0 z-[2000] flex items-center justify-center bg-neutral-950/60 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl bg-neutral-900/95 px-6 py-5 text-white shadow-2xl">
        <span
          aria-hidden
          className="h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-white"
        />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
