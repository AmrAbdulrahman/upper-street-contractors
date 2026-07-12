import "server-only";

import { GetProjectIdsDocument } from "@/generated/graphql";
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
 * - **Project pages** (`/projects/:id`) — genuinely CMS-driven (a publish can
 *   add one with no code change), so this list queries live via the same
 *   `GetProjectIds` used by `projects/[id]/page.tsx`'s `generateStaticParams`.
 */
const STATIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/rates",
  "/repairs-and-smaller-works",
  "/privacy-policy",
  "/terms-and-conditions",
  "/projects",
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
  const data = await query(GetProjectIdsDocument, {
    status: "published",
    includeUnpublished: false,
  });
  const projectPaths = (data?.projects ?? [])
    .filter((p): p is { id: string } => Boolean(p?.id))
    .map((p) => `/projects/${p.id}`);
  return [...STATIC_ROUTES, ...projectPaths];
}
