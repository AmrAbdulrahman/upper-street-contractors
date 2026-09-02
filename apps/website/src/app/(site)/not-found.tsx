import { NotFoundContent } from "@/components/not-found/not-found-content";

/**
 * The 404 for everything inside `(site)`.
 *
 * It renders the body ALONE, with no `SiteChrome` and no `CmsInspectShell`,
 * because this boundary fires *inside* `SiteLayout` — the header and footer are
 * already on screen. Mounting a second set here is what put two headers, two
 * footers, two <main>s and two skip links on the page.
 *
 * This file exists because a mistyped single-segment URL is no longer an
 * unmatched URL: since ADR 0020 `/kitchn` matches `(site)/[serviceSlug]`,
 * enters this group and calls `notFound()`. Same for `/blog/<missing>` and
 * `/projects/<missing>`. Only a multi-segment miss (`/foo/bar`) escapes the
 * group entirely, and that one is the root `app/not-found.tsx`.
 */
export default function SiteNotFound() {
  return <NotFoundContent />;
}
