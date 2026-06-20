"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getEntryFormDescriptor } from "@/lib/entry-editor/actions";
import type { EntryFormDescriptor } from "@/lib/entry-editor/types";
import {
  closeEditDrawer,
  useEditDrawerTarget,
  type EditDrawerTarget,
} from "./edit-drawer-store";
import { EditForm } from "./edit-form";
import { humanizeFieldName } from "./ui";

function trapTab(event: KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusables = container.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function DrawerSkeleton() {
  return (
    <div className="flex-1 space-y-4 px-4 py-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-surface" />
          <div className="h-10 animate-pulse rounded-md bg-surface" />
        </div>
      ))}
    </div>
  );
}

function DrawerUnavailable({ url }: { url: string }) {
  return (
    <div className="flex-1 px-4 py-6 text-sm text-muted">
      <p className="mb-3">Inline editing isn&apos;t available for this entry here.</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-gold underline hover:text-gold-mid"
      >
        Open in CMS
      </a>
    </div>
  );
}

// Remounted (via `key`) whenever the target changes, so the fetch runs once per
// target and the only setState happens in the resolved promise callback.
function DrawerBody({
  target,
  onClose,
}: {
  target: EditDrawerTarget;
  onClose: () => void;
}) {
  const [descriptor, setDescriptor] = useState<EntryFormDescriptor | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEntryFormDescriptor({
      typename: target.typename,
      documentId: target.documentId,
      focusedField: target.focusedField,
    }).then((result) => {
      if (!cancelled) setDescriptor(result);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!descriptor) return <DrawerSkeleton />;
  if (!descriptor.available) return <DrawerUnavailable url={descriptor.entryCmsUrl} />;
  return <EditForm descriptor={descriptor} onClose={onClose} />;
}

export default function EditDrawer() {
  const target = useEditDrawerTarget();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = target !== null;
  const [closing, setClosing] = useState(false);

  const finalize = useCallback(() => {
    closeEditDrawer();
    const trigger = triggerRef.current;
    if (trigger && document.contains(trigger)) {
      trigger.focus();
    }
  }, []);

  // Play the exit animation, then finalize on animationend. Under reduced
  // motion there's no animation (animationend never fires), so close at once.
  const handleClose = useCallback(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finalize();
      return;
    }
    setClosing(true);
  }, [finalize]);

  // Safety net: if animationend never arrives (element detached mid-animation),
  // finalize anyway so the drawer can't get stuck open.
  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(finalize, 400);
    return () => window.clearTimeout(id);
  }, [closing, finalize]);

  // Capture the triggering element + move initial focus to the close button
  // (a focused field, if any, auto-focuses afterwards and takes over).
  useEffect(() => {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    panelRef.current?.querySelector<HTMLElement>("[data-drawer-close]")?.focus();
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // ESC to close + focus trap.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key === "Tab") {
        trapTab(event, panelRef.current);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, handleClose]);

  if (typeof document === "undefined" || !target) return null;

  const title = humanizeFieldName(target.typename ?? "Entry");
  const bodyKey = `${target.typename}:${target.documentId}:${target.focusedField}`;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={`edit-drawer-backdrop absolute inset-0 bg-dark/40${
          closing ? " edit-drawer-backdrop--closing" : ""
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-drawer-title"
        onAnimationEnd={(event) => {
          if (closing && event.animationName === "edit-drawer-slide-out") {
            finalize();
          }
        }}
        className={`edit-drawer-panel absolute right-0 top-0 flex h-dvh flex-col bg-white shadow-lg${
          closing ? " edit-drawer-panel--closing" : ""
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="edit-drawer-title" className="text-base font-semibold text-foreground">
            Edit {title}
          </h2>
          <button
            data-drawer-close
            type="button"
            onClick={handleClose}
            aria-label="Close editor"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <DrawerBody key={bodyKey} target={target} onClose={handleClose} />
      </div>
    </div>,
    document.body,
  );
}
