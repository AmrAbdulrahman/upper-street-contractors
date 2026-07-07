'use client';

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import { ZeroCmsBar, ZeroCmsWidget } from "@usc/zero-cms-widget";
import { HugeRTEBlocksEditor } from "@usc/zero-cms-blocks";
import { revalidateCms } from "@/lib/cms/revalidate";
import { cmsNotify } from "@/lib/cms/notify";

const ADMIN_PREFIX = "/admin";
const CMS_PREFIX = "/admin/cms";

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

  // After a draft save (drawer) or publish (bar): clear the shared route cache and
  // refresh so the editor sees their change immediately.
  const onContentChange = useCallback(() => {
    void revalidateCms();
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
      router.push(ADMIN_PREFIX + href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, router]);

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

  const paramInspect = searchParams.get("inspect") === "true";

  useEffect(() => {
    onInspectChange(paramInspect);
  }, [paramInspect, onInspectChange]);

  const toggleInspect = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (paramInspect) params.delete("inspect");
    else params.set("inspect", "true");
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
    />
  );
}
