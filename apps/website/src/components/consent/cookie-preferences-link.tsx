"use client";

import { openPreferences } from "@/lib/consent/consent-store";

/**
 * Footer trigger that reopens Cookie Preferences — the always-available route to
 * change or withdraw consent after the first visit (ICO: as easy to withdraw as
 * to give).
 */
export function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openPreferences()}
      className={[
        "underline-offset-2 transition-colors hover:text-white hover:underline",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      Cookie preferences
    </button>
  );
}
