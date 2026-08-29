import Link from "next/link";
import { CONTACT_FORM_PATH } from "@/helpers";

type PlaceholderPageProps = {
  title: string;
  /** One sentence saying what this page will cover, in the client's own terms. */
  summary: string;
};

/**
 * A route whose full content is still being written.
 *
 * Two rules, both learned the hard way from the version this replaces:
 *
 *  1. **It never says "placeholder".** The old one printed that word as a gold
 *     overline above the heading, on two routes that were linked from the
 *     footer and submitted in the sitemap. A visitor is not an audience for our
 *     build status, and "Placeholder" on a live page is exactly what a content
 *     audit fails a site for.
 *  2. **It is not a dead end.** It says what the page will cover and offers the
 *     two things a visitor came for anyway — talk to someone, or go back to
 *     work we can already show them.
 *
 * It renders no `<main>` of its own: `SiteChrome` already provides one, and the
 * old nesting put a `<main>` inside a `<main>`, which is an invalid landmark
 * structure and gives screen-reader users two "main" regions to choose from.
 *
 * Every route using this must also set `robots: { index: false }` and stay out
 * of `STATIC_ROUTES` until it has real content.
 */
export function PlaceholderPage({ title, summary }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-container px-6 py-20">
      <h1 className="font-serif text-4xl text-dark">{title}</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{summary}</p>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        We&rsquo;re still writing this page. In the meantime, tell us what you
        need and we&rsquo;ll come back to you directly.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={CONTACT_FORM_PATH}
          className="inline-flex h-12 items-center justify-center rounded-full bg-gold px-6 text-base font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Request a Quote
        </Link>
        <Link
          href="/projects"
          className="inline-flex h-12 items-center justify-center rounded-full border-2 border-dark px-6 text-base font-semibold text-dark transition-colors hover:bg-border-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          See our recent work
        </Link>
      </div>
    </div>
  );
}
