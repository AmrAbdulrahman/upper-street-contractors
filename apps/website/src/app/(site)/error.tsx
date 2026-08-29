"use client"; // Error boundaries must be Client Components.

import Link from "next/link";
import { useEffect } from "react";

/**
 * Service unavailable — the fallback for any render error on a public page.
 *
 * It sits inside the `(site)` group on purpose, so the boundary is BELOW
 * `SiteChrome`: the header, footer and contact controls survive the error and
 * the visitor keeps a way to reach us. An error page at the app root would
 * replace the whole chrome and leave them with nothing but an apology.
 *
 * `unstable_retry()` re-fetches and re-renders the failed segment rather than
 * merely clearing React's error state, which is what makes it worth offering:
 * most errors here are a CMS read that timed out, and a second attempt often
 * just works.
 */
export default function SiteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side log for this failure —
    // production deliberately strips the real message before it reaches the
    // browser, so without printing it here a support report has nothing in it.
    console.error("[site] render failed", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-container px-6 py-20">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-deep">
        Something went wrong
      </p>
      <h1 className="mt-2 font-serif text-4xl text-dark">
        This page isn&rsquo;t loading
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        The problem is at our end, not yours. Try again in a moment — and if it
        keeps happening, contact us directly and we&rsquo;ll pick it up from
        there.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex h-12 cursor-pointer items-center justify-center rounded-full bg-gold px-6 text-base font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Try again
        </button>
        <Link
          href="/contact"
          className="inline-flex h-12 items-center justify-center rounded-full border-2 border-dark px-6 text-base font-semibold text-dark transition-colors hover:bg-border-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Contact us
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 text-xs text-muted">
          Reference: <span className="font-mono">{error.digest}</span> — quote
          this if you get in touch.
        </p>
      ) : null}
    </div>
  );
}
