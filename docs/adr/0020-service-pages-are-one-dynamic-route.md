# 20. Service pages are one dynamic route keyed by a page Slug

Date: 2026-08-30

## Status

Accepted

## Context

Adding a "+ New service" button to the Services index turned out to be
impossible, not merely unimplemented.

A Service was **three** things, only two of them content:

1. A route file — `app/(site)/kitchens/page.tsx`, one of nine near-identical
   37-line files differing only in `PAGE_KEY` and `PAGE_PATH`.
2. A CMS `page` entry, found by that hardcoded `key`.
3. A `service-card` on the Services index, carrying a **free-text** `href` the
   editor typed (`/kitchens`).

Nothing connected them. The card's `href` and the page's `key` were two
independently editable strings, and the mapping between them
(`/kitchens` → `kitchen-installations-service`) existed **only inside route
code**. The nine trades were *also* hardcoded a fourth time, as `SERVICE_LINKS`
in `nav-links.ts` — whose own comment claimed it and the card grid were "one
list, so the menu and `/services` cannot disagree". They were two lists kept in
step by hand.

So a Service created in the CMS had no URL, appeared in no menu, and its card
pointed at a 404 until someone shipped a deploy.

The CMS also had nothing to route *on*. A `page` had `key` and no slug, and the
nine keys are not derivable from their paths.

## Decision

**One `(site)/[serviceSlug]` route, resolving a `page` by a new `slug` field;
the card links to the page by reference.**

1. **`page.slug` is the routing identity.** Optional, and with **no `from`** —
   mirroring `title` the way a Blog Post's Slug does would mint a URL for every
   page in the CMS, and only Service pages are routed this way. `key` survives
   as the internal handle the remaining static routes look themselves up by.

2. **Rejected: reuse `key` as the slug.** No new field, but it would mean
   renaming nine keys that seed scripts and route files already use, and
   permanently conflating "which entry" with "which URL" for every page in the
   CMS — including the ones that will never have a URL of that shape.

3. **`service-card.page` replaces `service-card.href`.** A real reference; the
   link is derived as `/${card.page.slug}`. Two strings meaning one thing is a
   drift bug waiting to happen, and it is also what makes "create a Service"
   expressible at all: the card and the page are made and linked in one action.

4. **The Services menu reads the grid.** `SERVICE_LINKS` is gone;
   `getServiceLinks()` reads the Services index's `service-grid-section.cards`
   on the server and passes them to the header, which is a client component
   (`usePathname`) and cannot read the CMS itself. This is what `nav-links.ts`
   always claimed to be doing. An empty read renders `Services` as a plain link
   with no dropdown — correct, when there is nothing to drop down.

5. **The sitemap uses the other source.** `getAllSitePaths` lists every `page`
   carrying a slug, not the grid's cards: an unlisted Service page still
   resolves at its URL, and a crawlable page missing from the sitemap is the
   exact failure that file exists to prevent. A card is a promotion; a slug is
   an address.

6. **A root-level dynamic segment is safe here.** Next resolves static segments
   before dynamic ones, so `/blog`, `/projects`, `/services`, `/about`,
   `/contact`, `/rates`, the legal pages, `/admin` and `/api` all still win.
   Anything else falls through and `notFound()`s unless a page claims it.

## Consequences

**Good**

- A Service is now content. Creating one from `/services` gives a working URL, a
  menu entry, a sitemap entry and a card, with no deploy.
- Nine files deleted, and the fourth copy of the trade list with them. There is
  one list, and it is the one an editor already edits.
- `generateStaticParams` still prerenders every Service page, so nothing about
  the served output changes for the existing nine.

**Bad / accepted costs**

- **The 404 surface got wider.** Every unmatched single-segment path now runs a
  CMS query before 404ing, where it used to miss the route table outright. Cheap
  (one cached query) but not free, and a crawler hitting nonsense URLs pays it.
- **A slug typo moves a live URL.** `/kitchens` is an entry field now. That is
  the point, and it is also a way to break an indexed page from a text input
  with no redirect behind it. There is no slug history and no automatic 301.
- **Two sources of "what services exist"** — the grid (menu) and pages-with-a-
  slug (sitemap, static params). Deliberate, per decision 5, but they *can*
  disagree, and a page with a slug and no card is reachable and crawlable while
  being invisible in the UI.
- **`service-card.href` removal is a two-step deploy.** The GraphQL schema is
  generated from the CMS schema, so dropping the field while running code still
  selects it is an unknown-field error, not a null. The seed splits it: additive
  changes plus the backfill run any time, and `--drop-href` waits until nothing
  reads it. Getting that order wrong takes `/services` down.
- **`page.slug` is enforced for shape but not uniqueness.** zero-cms has no
  unique constraint, so two pages claiming one slug silently shadow each other —
  the route takes the first match. Identical to the Blog Post Slug trade
  recorded in `CONTEXT.md`, and de-duplicated the same way in
  `generateStaticParams`.
