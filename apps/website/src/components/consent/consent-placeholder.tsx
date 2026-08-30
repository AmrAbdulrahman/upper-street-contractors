"use client";

import { openPreferences } from "@/lib/consent/consent-store";

type ConsentPlaceholderProps = {
  /** What is hidden, e.g. "Trustpilot reviews". */
  label: string;
  /** `block` = full dashed panel (big embeds); `inline` = compact pill (badges). */
  variant?: "block" | "inline";
  className?: string;
};

/**
 * Inert stand-in rendered where a Consent-gated third-party embed would be when
 * its Consent category is refused. Offers to open Cookie Preferences instead —
 * so the content is never silently missing and consent stays one click away.
 * `inline` keeps small trust badges from blowing up their slot.
 */
export function ConsentPlaceholder({
  label,
  variant = "block",
  className,
}: ConsentPlaceholderProps) {
  if (variant === "inline") {
    return (
      // Opaque, not `bg-white/60`. This pill is placed on both a light
      // section and the navy Footer accreditation row, and a translucent
      // background takes its colour from whatever is behind it — over navy it
      // resolved to a mid grey, which put `text-muted` at 2.54:1. An opaque
      // fill makes the contrast a property of the component rather than of
      // wherever a caller happens to drop it.
      <button
        type="button"
        onClick={() => openPreferences()}
        className={[
          "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-medium text-muted transition-colors hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span aria-hidden="true">★</span> Show {label}
      </button>
    );
  }

  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-white/50 px-6 py-10 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-sm text-muted">
        {label} are hidden until you allow functional cookies.
      </p>
      <button
        type="button"
        onClick={() => openPreferences()}
        className="inline-flex h-10 items-center rounded-full border border-dark px-5 text-sm font-semibold text-dark transition-colors hover:bg-dark/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Cookie preferences
      </button>
    </div>
  );
}
