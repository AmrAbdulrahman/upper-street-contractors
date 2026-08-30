"use client";

/**
 * A blocking, full-screen "this is working" scrim, in brand colours.
 *
 * The enquiry wizard can upload up to ~196 MB of attachments one file at a
 * time before it even POSTs — minutes on a phone, during which the only signal
 * was a disabled button reading "Sending…". Blocking also stops a visitor
 * stepping backwards through the wizard mid-upload.
 *
 * Mounts nothing for the first {@link SHOW_AFTER_MS}. An action that finishes
 * quickly must not flash a scrim — the flash reads as a fault, and it is more
 * distracting than the silence it replaces.
 *
 * Deliberately not imported from `@usc/zero-cms-widget`, which has the same
 * component: the wizard renders for anonymous visitors, and that import would
 * drag the CMS widget into the public bundle.
 */

import { useEffect, useState } from "react";

const SHOW_AFTER_MS = 150;

export type BusyOverlayProps = {
  /** Whether the action is in flight. */
  show: boolean;
  /** What is happening, in the present tense — "Sending your enquiry…". */
  label: string;
  /** Optional second line: progress, a file name, a count. */
  detail?: string | null;
};

export function BusyOverlay({ show, label, detail }: BusyOverlayProps) {
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
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-dark/60 px-6 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl bg-white px-6 py-6 text-center shadow-lg">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-border-light border-t-gold"
        />
        <span className="font-semibold text-dark">{label}</span>
        {detail ? <span className="text-sm text-muted">{detail}</span> : null}
      </div>
    </div>
  );
}
