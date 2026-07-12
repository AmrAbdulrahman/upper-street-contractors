"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONSENT_CATEGORIES } from "@/lib/consent/categories";
import {
  acceptAll,
  closePreferences,
  getDefaultChoice,
  rejectAll,
  saveChoice,
  type ConsentChoice,
} from "@/lib/consent/consent-store";
import { useConsent } from "@/lib/consent/use-consent";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Switch({
  checked,
  disabled,
  onChange,
  labelledBy,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : () => onChange?.(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        checked ? "bg-gold" : "bg-subtle/40",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

const actionBtn =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/**
 * Cookie Preferences modal (see CONTEXT.md → "Cookie Preferences"). Lists every
 * Consent category with its purpose + third parties and a toggle; Strictly
 * necessary is shown on and disabled. Fully modal: portalled to <body>, focus
 * trapped, Escape/backdrop close, body scroll locked, focus restored on close.
 */
export function CookiePreferences() {
  const { choice } = useConsent();
  const [draft, setDraft] = useState<ConsentChoice>(
    () => choice ?? getDefaultChoice(),
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () =>
      dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        : [];

    (focusables()[0] ?? dialog)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePreferences();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-end justify-center bg-dark/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePreferences();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-prefs-title"
        aria-describedby="cookie-prefs-intro"
        tabIndex={-1}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-surface shadow-lg outline-none sm:max-w-lg sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 pt-6 pb-4">
          <div>
            <h2
              id="cookie-prefs-title"
              className="text-xl leading-tight text-dark"
            >
              Cookie preferences
            </h2>
            <p id="cookie-prefs-intro" className="mt-1 text-[13px] text-muted">
              Choose which cookies we may use. Strictly-necessary cookies are
              always on.
            </p>
          </div>
          <button
            type="button"
            onClick={() => closePreferences()}
            aria-label="Close cookie preferences"
            className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-muted transition-colors hover:bg-dark/5 hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            &times;
          </button>
        </div>

        <ul className="divide-y divide-border px-6">
          {CONSENT_CATEGORIES.map((category) => {
            const titleId = `cookie-cat-${category.key}`;
            const checked = category.locked
              ? true
              : draft[category.key as keyof ConsentChoice];
            return (
              <li key={category.key} className="flex gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p
                    id={titleId}
                    className="flex items-center gap-2 text-sm font-semibold text-dark"
                  >
                    {category.label}
                    {category.locked ? (
                      <span className="rounded-full bg-gold-light px-2 py-0.5 text-[11px] font-semibold text-gold-deep">
                        Always on
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    {category.purpose}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {category.providers.map((provider) => (
                      <li key={provider.name} className="text-[12px] text-subtle">
                        <span className="font-medium text-muted">
                          {provider.name}
                        </span>{" "}
                        — {provider.note}
                      </li>
                    ))}
                  </ul>
                </div>
                <Switch
                  checked={checked}
                  disabled={category.locked}
                  labelledBy={titleId}
                  onChange={(value) =>
                    setDraft((d) => ({ ...d, [category.key]: value }))
                  }
                />
              </li>
            );
          })}
        </ul>

        <p className="px-6 pt-3 text-[12px] leading-relaxed text-subtle">
          Turning a category off after you allowed it reloads the page to stop
          those widgets. Third parties set their own cookies once loaded — we
          can&rsquo;t delete those, but refusing stops them loading at all.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-5">
          <button
            type="button"
            onClick={() => rejectAll()}
            className={`${actionBtn} bg-white text-dark ring-1 ring-border hover:bg-border-light`}
          >
            Reject all
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => acceptAll()}
              className={`${actionBtn} bg-white text-dark ring-1 ring-border hover:bg-border-light`}
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => saveChoice(draft)}
              className={`${actionBtn} bg-gold text-white hover:brightness-110`}
            >
              Save choices
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
