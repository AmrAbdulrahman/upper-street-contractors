'use client';

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import { ZeroCmsBar, ZeroCmsWidget } from "@usc/zero-cms-widget";
import { HugeRTEBlocksEditor } from "@usc/zero-cms-blocks";
import { cmsNotify } from "@/lib/cms/notify";

const ADMIN_PREFIX = "/admin";
const CMS_PREFIX = "/admin/cms";
const INSPECT_PARAM = "inspect";
/**
 * Survives a navigation the click interceptor never sees — a form post, an
 * external round-trip, a typed URL, `exit-preview` and back. Session-scoped, so
 * it cannot leak edit mode into a new tab opened days later.
 */
const INSPECT_STORAGE_KEY = "zero-cms-inspect";

/** Site-relative href with `?inspect=true` added (or left alone when off). */
function withInspect(href: string, on: boolean): string {
  if (!on) return href;
  const url = new URL(href, window.location.origin);
  url.searchParams.set(INSPECT_PARAM, "true");
  return `${url.pathname}${url.search}${url.hash}`;
}

function readStoredInspect(): boolean {
  try {
    return window.sessionStorage.getItem(INSPECT_STORAGE_KEY) === "true";
  } catch {
    // Private mode / blocked storage. Edit mode still works, it just stops
    // surviving a full page load — never a reason to break the page.
    return false;
  }
}

function writeStoredInspect(on: boolean): void {
  try {
    window.sessionStorage.setItem(INSPECT_STORAGE_KEY, String(on));
  } catch {
    /* see readStoredInspect */
  }
}

/**
 * Whether the stored preference has already been applied for THIS document.
 *
 * Module scope, not a `useRef`. `InspectControls` reads `useSearchParams`, so it
 * lives under a Suspense boundary, and a query-only navigation can re-suspend
 * that boundary and remount the component — which resets a ref. That made
 * "turn off edit mode" impossible: the toggle dropped `?inspect=true`, the
 * remount re-armed the guard, and the restore put the parameter straight back.
 *
 * A module variable is scoped to the document instead, which is the actual unit
 * this should run once per: it survives every client-side navigation and resets
 * only on a real page load, which is exactly when restoring is wanted.
 */
let inspectRestored = false;

/**
 * Renders the zero-cms widget + admin bar (preview deploy only).
 *
 * `inspect` is driven by the `?inspect=true` query param read client-side via
 * `useSearchParams()`, so the toggle reacts instantly to client navigation (a
 * layout Server Component can't — it doesn't re-render on a query-only change).
 *
 * The widget provider stays mounted above `children` so they never remount, while
 * the param reader (which needs `useSearchParams`, hence a Suspense boundary) lives
 * in a sibling and lifts the inspect flag up via state. Inspect starts `false`, so
 * SSR + first client render emit plain children — the overlays activate after mount.
 */
export function CmsInspectShellClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [inspect, setInspect] = useState(false);

  // After a draft save (drawer) or publish (bar), refresh so the editor sees
  // their change immediately — enough on its own: preview reads bypass the
  // Data Cache entirely (query.ts), and publish-side ISR revalidation is
  // guaranteed at the RPC layer (server.ts withRevalidate), so no client-side
  // revalidate call belongs here. (One used to — it purged the whole public
  // Full Route Cache on every draft autosave.)
  const onContentChange = useCallback(() => {
    router.refresh();
  }, [router]);

  // Keep internal link clicks under /admin/* while browsing there — every
  // (site) link on the page (nav, footer, project cards, breadcrumbs, ...) is
  // written as a plain site-relative href (`/bathrooms`, `/projects/<id>`),
  // with no idea it's currently being served through proxy.ts's /admin/*
  // rewrite. Left alone, clicking any of them would jump straight to the bare
  // path — technically still in Draft Mode (the cookie persists independent
  // of URL), but losing the /admin context and its re-gating on the way.
  // Only active while actually under /admin/* and outside the dashboard
  // (/admin/cms, a distinct real app, not a mirrored page).
  //
  // It also has to carry `?inspect=true` across, which it did not: edit mode
  // lives entirely in the query string, and this handler rebuilt the URL from
  // the anchor's href alone. So every link an editor clicked while editing
  // dropped them back into read-only — the one navigation they make most.
  useEffect(() => {
    const underAdmin =
      pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
    const underCms = pathname === CMS_PREFIX || pathname.startsWith(`${CMS_PREFIX}/`);
    if (!underAdmin || underCms) return;

    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return; // e.g. target="_blank"
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return; // external/absolute/mailto/tel
      if (href.startsWith(ADMIN_PREFIX)) return; // already admin-aware (e.g. "Skip to content")
      e.preventDefault();
      router.push(withInspect(ADMIN_PREFIX + href, inspect));
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, router, inspect]);

  return (
    <>
      <ZeroCmsWidget
        inspect={inspect}
        auth={{ baseUrl: "" }}
        blocks={HugeRTEBlocksEditor}
        notify={cmsNotify}
        onSaved={onContentChange}
      >
        <Suspense fallback={null}>
          <InspectControls
            inspect={inspect}
            onInspectChange={setInspect}
            onContentChange={onContentChange}
          />
        </Suspense>
        {children}
      </ZeroCmsWidget>
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}

function InspectControls({
  inspect,
  onInspectChange,
  onContentChange,
}: {
  inspect: boolean;
  onInspectChange: (inspect: boolean) => void;
  onContentChange: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramInspect = searchParams.get(INSPECT_PARAM) === "true";

  useEffect(() => {
    onInspectChange(paramInspect);
  }, [paramInspect, onInspectChange]);

  // The URL stays the source of truth; sessionStorage is only a memory of the
  // last choice, so a navigation the click interceptor cannot intercept — a
  // full page load, a typed URL, a browser back out of an external link — comes
  // back in edit mode instead of silently dropping to read-only.
  //
  // Runs once. A `replace`, not a `push`: restoring a state the editor never
  // left should not cost them a history entry, and it must not be undoable by
  // pressing Back straight back into the URL that triggered it.
  useEffect(() => {
    if (inspectRestored) return;
    inspectRestored = true;

    const underCms = pathname === CMS_PREFIX || pathname.startsWith(`${CMS_PREFIX}/`);
    if (underCms || paramInspect || !readStoredInspect()) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set(INSPECT_PARAM, "true");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, paramInspect, searchParams, router]);

  useEffect(() => {
    writeStoredInspect(paramInspect);
  }, [paramInspect]);

  const toggleInspect = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (paramInspect) params.delete(INSPECT_PARAM);
    else params.set(INSPECT_PARAM, "true");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // /admin/bathrooms -> /bathrooms, /admin -> / — same mirror rule proxy.ts's
  // own rewrite uses. A real `<a href>` (see ZeroCmsBar), not router.push:
  // exiting needs the exit-preview Route Handler to run (draftMode().disable()
  // before the redirect target's request happens), not a client-side transition.
  const sitePath = pathname === ADMIN_PREFIX ? "/" : pathname.slice(ADMIN_PREFIX.length) || "/";
  const closeHref = `/admin/exit-preview?next=${encodeURIComponent(sitePath)}`;

  return (
    <ZeroCmsBar
      inspect={inspect}
      onToggleInspect={toggleInspect}
      onChange={onContentChange}
      closeHref={closeHref}
      // Site-wide settings — name, logos, metadata, contact details, social
      // links — belong to no page, so no pencil on the site can reach them.
      settingsType="site-meta-config"
      settingsLabel="Site settings"
    />
  );
}
