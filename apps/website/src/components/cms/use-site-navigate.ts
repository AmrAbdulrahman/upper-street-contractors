"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

const ADMIN_PREFIX = "/admin";
const INSPECT_PARAM = "inspect";

/**
 * Navigate to a site path from inside editing chrome, staying wherever the
 * editor already is.
 *
 * Every href on the site is written bare (`/blog`, `/projects/<id>`) with no
 * idea it may be served through proxy.ts's `/admin/*` Draft Mode mirror. A
 * click on one is fixed up by the link interceptor in `cms-inspect-shell-client`
 * — but a `router.replace()` from a delete handler is not a click, so it dropped
 * the editor out of `/admin` and out of edit mode on the one navigation they did
 * not choose to make. This is that interceptor's rule, for code paths that
 * navigate without an anchor.
 *
 * Outside `/admin/*` (a public page, which has no editing chrome to keep) it is
 * a plain `router.push` / `router.replace`.
 *
 * The inspect flag is read off `location` at call time rather than through
 * `useSearchParams`: this hook is mounted by pages that prerender, and that hook
 * would demand a Suspense boundary around every one of them for a value only a
 * click ever needs.
 */
export function useSiteNavigate() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (path: string, opts?: { replace?: boolean }) => {
      const underAdmin =
        pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
      const target = underAdmin ? `${ADMIN_PREFIX}${path}` : path;
      const inspect =
        underAdmin &&
        new URLSearchParams(window.location.search).get(INSPECT_PARAM) === "true";
      const href = inspect ? `${target}?${INSPECT_PARAM}=true` : target;
      if (opts?.replace) router.replace(href);
      else router.push(href);
    },
    [router, pathname],
  );
}
