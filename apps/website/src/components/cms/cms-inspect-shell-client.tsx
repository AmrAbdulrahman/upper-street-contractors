'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import { BusyOverlay, ZeroCmsBar, ZeroCmsWidget } from "@usc/zero-cms-widget";
import { HugeRTEBlocksEditor } from "@usc/zero-cms-blocks";
import { cmsNotify } from "@/lib/cms/notify";

const ADMIN_PREFIX = "/admin";
const CMS_PREFIX = "/admin/cms";
const INSPECT_PARAM = "inspect";
/**
 * Remembers edit mode across navigations the click interceptor never sees — a
 * form post, an external round-trip, a typed URL, `exit-preview` and back.
 *
 * `localStorage`, not `sessionStorage`. It was session-scoped so edit mode could
 * not surface in a tab opened days later, but that also meant an editor who
 * closed the tab came back read-only every single time, which is the state they
 * are almost never in. Persisting costs one surprise on a stale tab; not
 * persisting cost a re-toggle on every visit.
 *
 * Being shared across tabs is then a real difference, so it is handled rather
 * than ignored: a `storage` listener keeps every open /admin tab in step.
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
    return window.localStorage.getItem(INSPECT_STORAGE_KEY) === "true";
  } catch {
    // Private mode / blocked storage. Edit mode still works, it just stops
    // being remembered — never a reason to break the page.
    return false;
  }
}

function writeStoredInspect(on: boolean): void {
  try {
    window.localStorage.setItem(INSPECT_STORAGE_KEY, String(on));
  } catch {
    /* see readStoredInspect */
  }
}

/** The current URL with `?inspect=true` present or absent, as `on` requires. */
function inspectUrl(
  pathname: string,
  searchParams: URLSearchParams,
  on: boolean,
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (on) params.set(INSPECT_PARAM, "true");
  else params.delete(INSPECT_PARAM);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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
 *
 * It matters more now that the preference is persistent: without the latch, the
 * restore would keep re-applying a stored `true` and "turn off edit mode" would
 * be undone a frame after every click.
 */
let inspectRestored = false;

/**
 * Renders the zero-cms widget + admin bar (preview deploy only).
 *
 * `inspect` lives in state here, and `?inspect=true` mirrors it. It used to be
 * the other way round, with the toggle doing a `router.push` and the param
 * driving the flag — which made every toggle wait on an RSC payload for the
 * whole route tree. Nothing on the server reads the parameter (the only server
 * gate is Draft Mode), so that round trip bought nothing at all. The parameter
 * is kept because it makes an edit-mode URL shareable and reloadable, and
 * because the link interceptor below carries it across /admin navigations.
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
  const [syncingUrl, startUrlSync] = useTransition();

  const paramInspect = searchParams.get(INSPECT_PARAM) === "true";
  const underCms = pathname === CMS_PREFIX || pathname.startsWith(`${CMS_PREFIX}/`);

  // Restore, once per document. An explicit `?inspect=true` wins — a shared or
  // typed URL says what it wants — otherwise the remembered preference applies,
  // so a navigation the click interceptor cannot intercept (a full page load, a
  // typed URL, a browser Back out of an external link) comes back in edit mode
  // instead of silently dropping to read-only.
  //
  // Nothing navigates here. The old restore did a `router.replace` after first
  // paint; setting state does the same job without the round trip, and the URL
  // effect below catches up on its own.
  useEffect(() => {
    if (inspectRestored) return;
    inspectRestored = true;
    if (underCms) return;

    const initial = paramInspect || readStoredInspect();
    // A URL-supplied `true` is a choice too, so it is remembered like any other.
    writeStoredInspect(initial);
    if (initial) onInspectChange(true);
  }, [underCms, paramInspect, onInspectChange]);

  // Mirror the flag into the URL. A `replace`, not a `push`: this is bookkeeping
  // for a state the editor is already looking at, and it must not be undoable by
  // pressing Back straight into the URL that triggered it. `scroll: false`
  // because the page has not changed — only its query string has.
  useEffect(() => {
    if (underCms || paramInspect === inspect) return;
    startUrlSync(() => {
      router.replace(inspectUrl(pathname, searchParams, inspect), {
        scroll: false,
      });
    });
  }, [inspect, paramInspect, pathname, router, searchParams, underCms]);

  // One preference, possibly several open /admin tabs. `storage` fires only in
  // the *other* tabs, so this is what stops two of them silently disagreeing
  // until one of them happens to navigate.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== INSPECT_STORAGE_KEY) return;
      onInspectChange(event.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [onInspectChange]);

  const toggleInspect = () => {
    const next = !inspect;
    // Synchronous, and deliberately so — the pencils appear on this click, not
    // when a network round trip decides to come back.
    writeStoredInspect(next);
    onInspectChange(next);
  };

  // /admin/bathrooms -> /bathrooms, /admin -> / — same mirror rule proxy.ts's
  // own rewrite uses. A real `<a href>` (see ZeroCmsBar), not router.push:
  // exiting needs the exit-preview Route Handler to run (draftMode().disable()
  // before the redirect target's request happens), not a client-side transition.
  const sitePath = pathname === ADMIN_PREFIX ? "/" : pathname.slice(ADMIN_PREFIX.length) || "/";
  const closeHref = `/admin/exit-preview?next=${encodeURIComponent(sitePath)}`;

  return (
    <>
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
      {/* A safety net, not the mechanism: the toggle itself is synchronous, so
          this only ever shows if the URL mirror genuinely stalls. */}
      <BusyOverlay show={syncingUrl} label="Switching edit mode…" />
    </>
  );
}
