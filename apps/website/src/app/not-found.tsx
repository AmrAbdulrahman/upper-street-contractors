import Link from "next/link";
import { SiteChrome } from "@/components/layout/site-chrome";
import { CmsInspectShell } from "@/components/cms/cms-inspect-shell";
import { PageSections } from "@/components/sections/page-sections";
import { GetPageDocument } from "@/generated/graphql";
import { CONTACT_FORM_PATH } from "@/helpers";
import { query } from "@/lib/cms/query";

const PAGE_KEY = "not-found";

/**
 * The 404. Reached two ways: an explicit `notFound()` inside a route, and — as
 * the ROOT `not-found.tsx` — every URL that matches no route at all.
 *
 * It lives outside the `(site)` route group, so it inherits none of that
 * group's layout. That is why it mounts `CmsInspectShell` + `SiteChrome`
 * itself: without them a mistyped URL dropped the visitor onto a bare centred
 * heading with no header, no footer, no navigation and no way to contact
 * anyone — a dead end at exactly the moment someone is already lost. A 404 in
 * a route group (`(site)/not-found.tsx`) would not help, because an unmatched
 * URL never enters the group.
 *
 * The body is CMS content (`page` key `not-found`), so an editor can build it
 * out of ordinary sections. The hardcoded fallback below is not decoration: the
 * 404 is the page most likely to be rendered while something else is wrong, and
 * it must not depend on the CMS being reachable to say something useful.
 *
 * No `metadata` export — Next only supports one on `global-not-found`, and it
 * already injects `noindex` for anything returning a 404.
 */
async function getNotFoundPage() {
  try {
    const data = await query(GetPageDocument, { key: PAGE_KEY });
    return data?.pages?.at(0) ?? null;
  } catch {
    return null;
  }
}

export default async function NotFoundPage() {
  const page = await getNotFoundPage();

  return (
    <CmsInspectShell>
      <SiteChrome>
        {page ? <PageSections page={page} /> : <NotFoundFallback />}
      </SiteChrome>
    </CmsInspectShell>
  );
}

const suggestions = [
  { href: "/projects", label: "Recent projects", hint: "Work we have finished in North London" },
  { href: "/refurbishments", label: "Refurbishments", hint: "Whole-home and single-room projects" },
  { href: "/bathrooms", label: "Bathrooms", hint: "Renovations and wetroom conversions" },
  { href: "/kitchens", label: "Kitchens", hint: "Installations and layout changes" },
  { href: "/blog", label: "Advice", hint: "Guides on planning, cost and timing" },
  { href: "/about", label: "About us", hint: "Who we are and how we work" },
];

function NotFoundFallback() {
  return (
    <div className="mx-auto w-full max-w-container px-6 py-20">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-deep">
        404
      </p>
      <h1 className="mt-2 font-serif text-4xl text-dark">
        We can&rsquo;t find that page
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        The link may be out of date, or the page may have moved. Here are the
        places people usually want.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block h-full rounded-2xl border border-border bg-white p-5 transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <span className="block font-semibold text-dark">{item.label}</span>
              <span className="mt-1 block text-sm text-muted">{item.hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={CONTACT_FORM_PATH}
          className="inline-flex h-12 items-center justify-center rounded-full bg-gold px-6 text-base font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Request a Quote
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full border-2 border-dark px-6 text-base font-semibold text-dark transition-colors hover:bg-border-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
