import "server-only";

import { GetBlogSlugsDocument, GetProjectIdsDocument } from "@/generated/graphql";
import { query } from "@/lib/cms/query";

/**
 * Every crawlable public path on the site — the single source both
 * `app/sitemap.ts` and the post-publish cache-warm pass (`zero-cms/server.ts`)
 * read from (ADR 0012). Never includes `/admin/*` (the Draft Mode mirror,
 * excluded from the sitemap/robots separately — see `robots.ts`).
 *
 * Two different kinds of route, deliberately not unified into one mechanism:
 *
 * - **Static marketing pages** — one per `app/(site)/<slug>/page.tsx`. These
 *   only change via a code deploy (adding/removing/renaming a folder), which
 *   already regenerates everything, so a hardcoded list is correct, not a
 *   shortcut. Each entry mirrors that page's own `PAGE_PATH` constant — kept
 *   as a literal list rather than walking the filesystem at request time
 *   because Vercel's deployed function doesn't ship raw `app/` source to
 *   introspect (readdir-based enumeration only works at build time, which is
 *   exactly the mistake the old `scripts/generate-sitemap.mjs` made without
 *   the walk even reaching these routes — see ADR 0012).
 * - **Project pages** (`/projects/:id`) and **Blog posts** (`/blog/:slug`) —
 *   genuinely CMS-driven (a publish can add one with no code change), so this
 *   list queries live via the same `GetProjectIds` / `GetBlogSlugs` used by
 *   those routes' own `generateStaticParams`.
 *
 * Blog posts matter here more than most: the Blog index paginates client-side,
 * so a post on page 3 is not linked from the first screen of HTML. The sitemap
 * is what makes every post discoverable regardless of where the pager puts it.
 *
 * Only the CURRENT paths belong here. `/blogs/*` still resolves — as a 308 to
 * `/blog/*` (see `next.config.mjs`) — but a redirect is not a crawlable page and
 * listing it would ask crawlers to index a URL that only points elsewhere.
 */
/**
 * Deliberately absent: `/rates`. The route still resolves but carries no real
 * content yet and is marked `robots: { index: false }` on the page itself.
 * Submitting a noindexed page in the sitemap asks a crawler to fetch a URL we
 * have just told it not to keep. Add it back with the content.
 *
 * `/repairs-and-smaller-works` used to be listed here for the same reason. The
 * route is gone — its only inbound link was the What We Do banner — and it now
 * 308s to `/services`.
 *
 * `/services` matters more than a normal marketing page: it is the only place
 * that links all nine Service pages now that the footer's Services column is
 * gone and the header keeps them behind a dropdown.
 */
const STATIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms-and-conditions",
  "/services",
  "/projects",
  "/blog",
  "/refurbishments",
  "/kitchens",
  "/bathrooms",
  "/plumbing",
  "/heating",
  "/electric",
  "/carpentry",
  "/roofing",
  "/handyman",
] as const;

export async function getAllSitePaths(): Promise<string[]> {
  // Explicit published/no-unpublished, overriding query()'s preview defaults
  // regardless of the caller's own Draft Mode state (see query.ts: caller
  // variables always win over the preview spread) — both consumers of this
  // list, sitemap.ts and the post-publish warm pass, must always reflect
  // what a real anonymous visitor can see, never a signed-in editor's own
  // draft/preview session, even when this happens to run inside one (the
  // warm pass executes within the authenticated RPC call's request scope).
  const [projectData, blogData] = await Promise.all([
    query(GetProjectIdsDocument, { status: "published", includeUnpublished: false }),
    query(GetBlogSlugsDocument, { status: "published", includeUnpublished: false }),
  ]);
  const projectPaths = (projectData?.projects ?? [])
    .filter((p): p is { id: string } => Boolean(p?.id))
    .map((p) => `/projects/${p.id}`);
  // De-duplicated for the same reason generateStaticParams is: `slug` carries no
  // unique constraint, so two posts can claim one path.
  const blogSlugs = new Set(
    (blogData?.blogPosts ?? [])
      .map((p) => p?.slug?.trim())
      .filter((slug): slug is string => Boolean(slug)),
  );
  const blogPaths = [...blogSlugs].map((slug) => `/blog/${slug}`);
  return [...STATIC_ROUTES, ...projectPaths, ...blogPaths];
}
