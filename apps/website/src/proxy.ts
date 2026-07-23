/**
 * `/admin/*` (except `/admin/cms/*`, the real dashboard app) doesn't have its
 * own pages — it mirrors the public `(site)` routes, rendered in Draft Mode so
 * editors see draft/unpublished content inline (the in-place widget bar shows
 * up because `isPreview()` is true). Getting there requires two gates Proxy is
 * the only place that can enforce server-side, before any page renders:
 *
 *  1. **Session** — `zero_cms_session` (see `/api/cms/auth`) is the same HMAC
 *     JWT the RPC handler verifies; checked here too since Proxy has no access
 *     to the browser's localStorage token. No valid session -> bounce to the
 *     dashboard, which shows the sign-in form itself (`AuthGate`).
 *  2. **Draft Mode** — Next's own per-request mechanism (`__prerender_bypass`
 *     cookie). `enable()` can only be called from a Route Handler
 *     (`/admin/enable-preview`), so an authenticated visitor without it yet
 *     gets redirected through there once, then rewritten to the real page.
 *     The reverse (`disable()`, `/admin/exit-preview`) is how the bar's
 *     Close/Log out buttons leave cleanly without the one-render draft flash
 *     described below (ZeroCmsBar.tsx).
 *
 * Draft Mode's cookie is browser-wide, not scoped to /admin/* — so leaving the
 * prefix (clicking away, or editing the URL by hand) doesn't clear it on its
 * own, and a bare (site) path would otherwise keep rendering draft content +
 * the editor bar until the cookie's own expiry. Proxy now runs on every page
 * (not just /admin/*) specifically so it can clear that cookie the moment a
 * request lands outside /admin/* while Draft Mode is still on — see the
 * `!isAdmin` branch below. (One caveat: this can only affect the *next*
 * request, not retroactively change what the *current* render sees, since
 * `draftMode().isEnabled` reads the incoming request's cookie before Proxy's
 * response is sent — so the very page you land on right after leaving /admin
 * may still show draft content once, correcting itself on the next
 * navigation/reload.)
 *
 * Renamed from `middleware.ts` per Next 16 (middleware -> Proxy, Node.js
 * runtime by default — required here anyway since `verifyToken` uses
 * `node:crypto`).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@usc/zero-cms-core/node";

const SESSION_COOKIE = "zero_cms_session";
const DRAFT_COOKIE = "__prerender_bypass"; // Next's own Draft Mode cookie (documented name).
const ADMIN_PREFIX = "/admin";
const CMS_PREFIX = "/admin/cms";
const ENABLE_PREVIEW_PATH = "/admin/enable-preview";
const EXIT_PREVIEW_PATH = "/admin/exit-preview";

function hasValidSession(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.ZERO_CMS_AUTH_SECRET;
  if (!token || !secret) return false;
  return verifyToken(token, secret) !== null;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdmin = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  if (!isAdmin) {
    if (!request.cookies.has(DRAFT_COOKIE)) return NextResponse.next();
    // Only clear on a real document navigation. The (site) pages an editor is
    // previewing under /admin/* are full of bare-path <Link>s; in production
    // Next prefetches those, and each prefetch (plus any client-side RSC
    // fetch) lands here with the Draft Mode cookie attached. Deleting it on
    // those responses silently killed Draft Mode while the editor never left
    // /admin — the next router.refresh() then unmounted the whole editing
    // shell mid-typing (bar + drawer vanish until a manual reload re-enables
    // preview). A hand-typed/bookmarked bare URL is a document request, so
    // the original leave-/admin cleanup still fires for it.
    // `Sec-Fetch-Dest`, not Next's own `RSC`/`Next-Router-Prefetch` headers —
    // Next strips those from external requests before middleware runs, so a
    // browser's real prefetch is indistinguishable by them here. The browser
    // sets Sec-Fetch-Dest itself: `document` only for a real navigation,
    // `empty` for prefetch/RSC fetches. Absent (curl, bots, legacy browsers)
    // counts as a navigation, preserving the original cleanup.
    const dest = request.headers.get("sec-fetch-dest");
    if (dest !== null && dest !== "document") return NextResponse.next();
    const res = NextResponse.next();
    res.cookies.delete(DRAFT_COOKIE);
    return res;
  }

  // The real dashboard app + its own preview-enabling route gate themselves
  // (AuthGate client-side, session check inline below) — never mirrored.
  if (pathname === CMS_PREFIX || pathname.startsWith(`${CMS_PREFIX}/`)) {
    return NextResponse.next();
  }
  if (pathname === ENABLE_PREVIEW_PATH) {
    return NextResponse.next();
  }
  // Unlike enable-preview, no session check: leaving preview (the bar's
  // Close/Log out buttons — see ZeroCmsBar.tsx) isn't privileged, and must
  // still work even when the session cookie was just cleared by a logout.
  if (pathname === EXIT_PREVIEW_PATH) {
    return NextResponse.next();
  }

  if (!hasValidSession(request)) {
    return NextResponse.redirect(new URL(CMS_PREFIX, request.url));
  }

  if (!request.cookies.has(DRAFT_COOKIE)) {
    const next = encodeURIComponent(pathname + request.nextUrl.search);
    return NextResponse.redirect(
      new URL(`${ENABLE_PREVIEW_PATH}?next=${next}`, request.url)
    );
  }

  // Mirror: /admin -> /, /admin/projects/1 -> /projects/1 — same (site) page,
  // Draft Mode makes it render draft/unpublished content instead of production.
  const url = request.nextUrl.clone();
  url.pathname = pathname.slice(ADMIN_PREFIX.length) || "/";
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except static assets/API routes — was just /admin/*, but the
  // Draft-Mode-cookie cleanup above needs to see requests to bare (site)
  // paths too, not only /admin/*.
  //
  // `zero-cms` (the RPC endpoint, /zero-cms/rpc) has to be excluded here too,
  // same as `api` — it doesn't share that prefix, so without this the bug it
  // was added to guard against just moves one level down: every RPC call the
  // *dashboard itself* makes (loading entries, listDrafts, ...) would hit the
  // `!isAdmin` branch (since /zero-cms/rpc isn't under /admin/*) and clear the
  // Draft Mode cookie out from under an editor who never left /admin at all.
  matcher: ["/((?!api|zero-cms|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
