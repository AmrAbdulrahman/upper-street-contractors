# 12. Eagerly warm every route after publish; sitemap becomes a live route

Date: 2026-07-07

## Status

Accepted — extends [ADR 0010](./0010-vercel-only-deployment-isr.md) (blunt, whole-site ISR invalidation on publish). Does not reverse that decision: invalidation is still whole-site, not per-entry.

## Context

ADR 0010 established that every publish-affecting RPC op calls `revalidatePath("/", "layout")` — a deliberate whole-site cache purge, accepted at this content scale (39 routes today) instead of building precise per-entry invalidation. What it didn't address: `revalidatePath`/`revalidateTag` only *purge*. Regeneration is lazy — the next visitor to any purged route pays a synchronous, blocking full render. Since invalidation is whole-site, that cost applies to *every* route after *any* publish, not just the one entry that changed.

Separately: `apps/website/public/sitemap.xml` was a static file written once by `scripts/generate-sitemap.mjs` during `npm run build`. Two problems, found while building this:

1. **Structural** — Vercel's production filesystem is read-only at runtime, so nothing server-side can ever rewrite this file after deploy. A project or page published after the last deploy is live on its own URL but permanently absent from the sitemap until the next redeploy.
2. **Correctness** — independent of (1), the script's route-collection already produced a wrong sitemap: it never walks into route-group directories (`app/(site)/...`, skipped because the traversal bails on any segment starting with `(`), so every static marketing page was silently absent. It fell back to mapping CMS `page.key` values (e.g. `bathroom-renovations-service`) straight into a URL path, but that key is an internal identifier, not a URL slug — production's actual sitemap.xml contained fabricated 404 URLs (`/bathroom-renovations-service`) instead of the real ones (`/bathrooms`), for every service page.

## Decision

- **Warm, don't just purge.** `withRevalidate()` (`apps/website/src/lib/zero-cms/server.ts`) now follows `revalidateTag`/`revalidatePath` with a background pass that self-fetches every known route, so the Full Route Cache is repopulated before a real visitor arrives rather than on their request.
- **Background work uses `after()`** (`next/server`), not a bare un-awaited promise. Vercel can freeze a function's execution environment immediately once the response is sent; `after()` is the supported way to keep it alive for trailing work. A bare fire-and-forget fetch would warm intermittently and fail silently.
- **Self-fetch origin**: `process.env.VERCEL_URL` when set (every Vercel deployment — preview and prod — provides it), falling back to `http://localhost:${PORT ?? 3000}` for local dev. Local warming is a no-op in effect (dev mode doesn't cache renders the same way) but exercises the same code path everywhere.
- **Route list is shared, not duplicated**, between the warm step and the sitemap: `apps/website/src/lib/cms/site-routes.ts` exports the one list both consume — a hardcoded array of the site's static marketing routes (they only change via a code deploy, which already regenerates everything) plus a live query for `/projects/{id}` per published project (the only actually-dynamic, CMS-driven route set today).
- **`public/sitemap.xml` (static file + `scripts/generate-sitemap.mjs` + the `generate:sitemap` prebuild step) is retired**, replaced by `apps/website/src/app/sitemap.ts` (Next's native `MetadataRoute.Sitemap` convention) built on the same shared route list. Always live, no rebuild needed for new content, no drift between what's crawlable and what the sitemap claims exists.
- Warming still runs for every publish-affecting op, at whole-site scope — this ADR does not change *what* gets invalidated (still ADR 0010's blunt whole-site call), only adds an eager-regeneration step after it and fixes the separately-broken sitemap.

## Considered options

- **Leave regeneration lazy** (status quo before this ADR). Rejected: means the first real visitor after every publish — to every route on the site, not just the changed one — pays a full blocking render. At today's scale (39 routes) the warm pass is cheap; revisit if the route count grows enough to make warming itself expensive (same "revisit if it grows" escape hatch ADR 0010 used for precise invalidation).
- **Bare un-awaited fetch instead of `after()`**. Rejected: no reliability guarantee on Vercel's serverless runtime — the function can be torn down before the fetches land, making warming silently flaky.
- **Keep the static sitemap.xml, just run the generator script more often.** Rejected: there's no server-side moment on Vercel's production runtime where a script could re-run and rewrite a public/ file — the read-only filesystem makes this impossible outright, not just inconvenient.

## Consequences

- `scripts/generate-sitemap.mjs`, `apps/website/public/sitemap.xml`, and the `generate:sitemap` step in root `package.json`'s `build` script are deleted.
- Every publish now costs one extra background pass of N self-fetches (N = route count). Acceptable at current scale; watch if the site grows substantially.
- `robots.ts` already points to `${siteUrl}/sitemap.xml` — unaffected, since Next serves `sitemap.ts` at that same public path.
