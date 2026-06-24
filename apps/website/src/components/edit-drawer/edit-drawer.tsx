"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getEntryFormDescriptor,
  publishEntries,
  unpublishEntries,
} from "@/lib/entry-editor/actions";
import type { EntryFormDescriptor } from "@/lib/entry-editor/types";
import { refreshChangedEntries } from "./changed-entries-store";
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

/**
 * Header toggle controlling whether the edited entry is published (shown on the
 * live site) or Draft (hidden). Acts immediately, independent of the form's Save.
 */
function EntryPublishToggle({
  documentId,
  typename,
  initialPublished,
}: {
  documentId: string;
  typename: string | null;
  initialPublished: boolean;
}) {
  const router = useRouter();
  const [published, setPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);

  const toggle = () => {
    if (busy) return;
    const next = !published;
    setBusy(true);
    (next ? publishEntries : unpublishEntries)([{ typename, documentId }]).then(
      (result) => {
        setBusy(false);
        if (!result.ok) {
          toast.error(
            `Couldn't ${next ? "publish" : "set to draft"}: ${result.errors
              .map((entry) => entry.error)
              .join("; ")}`,
          );
          return;
        }
        setPublished(next);
        toast.success(
          next ? "Published — now live" : "Set to Draft — hidden from live",
        );
        refreshChangedEntries();
        router.refresh();
      },
    );
  };

  return (
    <span className="flex shrink-0 items-center gap-2">
      <span
        className={`text-xs font-medium ${published ? "text-whatsapp" : "text-red-600"}`}
      >
        {published ? "Live" : "Draft"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label={
          published
            ? "Unpublish — hide from the live site"
            : "Publish — show on the live site"
        }
        disabled={busy}
        onClick={toggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          published ? "bg-whatsapp" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            published ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </span>
  );
}

export default function EditDrawer() {
  const target = useEditDrawerTarget();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [resolved, setResolved] = useState<{
    target: EditDrawerTarget;
    descriptor: EntryFormDescriptor;
  } | null>(null);

  const open = target !== null;
  const [closing, setClosing] = useState(false);

  // Fetch the entry descriptor (drives both the header toggle and the form).
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    getEntryFormDescriptor({
      typename: target.typename,
      documentId: target.documentId,
      focusedField: target.focusedField,
    }).then((result) => {
      if (!cancelled) setResolved({ target, descriptor: result });
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Use the descriptor only once it matches the current target — otherwise we're
  // still loading (keeps the skeleton up when the target switches mid-open).
  const descriptor =
    resolved && resolved.target === target ? resolved.descriptor : null;

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
  const showToggle =
    descriptor?.available && descriptor.draftPublish && !!descriptor.documentId;

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
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2
              id="edit-drawer-title"
              className="truncate text-base font-semibold text-foreground"
            >
              Edit {title}
            </h2>
            {showToggle ? (
              <EntryPublishToggle
                key={descriptor.documentId}
                documentId={descriptor.documentId as string}
                typename={descriptor.typename}
                initialPublished={descriptor.published}
              />
            ) : null}
          </div>
          <button
            data-drawer-close
            type="button"
            onClick={handleClose}
            aria-label="Close editor"
            className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface"
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

        {!descriptor ? (
          <DrawerSkeleton />
        ) : !descriptor.available ? (
          <DrawerUnavailable url={descriptor.entryCmsUrl} />
        ) : (
          <EditForm
            key={`${descriptor.typename}:${descriptor.documentId}`}
            descriptor={descriptor}
            onClose={handleClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
