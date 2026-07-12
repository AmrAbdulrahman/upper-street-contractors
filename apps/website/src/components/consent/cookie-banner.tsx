"use client";

import { acceptAll, openPreferences, rejectAll } from "@/lib/consent/consent-store";

// Reject all and Accept all are given identical size/weight so refusing is as
// easy as accepting (ICO). Manage is the clearly-secondary route into detail.
const primaryBtn =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const acceptBtn = `${primaryBtn} bg-gold text-white hover:brightness-110`;
const rejectBtn = `${primaryBtn} bg-white text-dark hover:bg-white/90`;
const manageBtn = `${primaryBtn} border border-white/35 text-white hover:bg-white/10`;

/**
 * First-visit consent bar (see CONTEXT.md → "Cookie Banner"). Shown only while
 * no Consent choice is recorded; the entry (cookie-consent.tsx) unmounts it once
 * a choice exists. Non-modal: it never traps focus or blocks the page.
 */
export function CookieBanner() {
  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-white/10 bg-dark text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-container flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-white/80 sm:max-w-2xl">
          We use strictly-necessary cookies to make this site work. We&rsquo;d
          also like to load Trustpilot and Google reviews (functional cookies),
          but only with your consent. You can change this anytime from{" "}
          <button
            type="button"
            onClick={() => openPreferences()}
            className="underline underline-offset-2 hover:text-white"
          >
            Cookie preferences
          </button>
          .
        </p>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button type="button" onClick={() => rejectAll()} className={rejectBtn}>
            Reject all
          </button>
          <button
            type="button"
            onClick={() => openPreferences()}
            className={manageBtn}
          >
            Manage
          </button>
          <button type="button" onClick={() => acceptAll()} className={acceptBtn}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
