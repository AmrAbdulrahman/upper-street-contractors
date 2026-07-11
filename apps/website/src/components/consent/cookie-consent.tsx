"use client";

import { useEffect, useState } from "react";
import { useConsent } from "@/lib/consent/use-consent";
import { CookieBanner } from "./cookie-banner";
import { CookiePreferences } from "./cookie-preferences";

/**
 * Consent entry mounted once in SiteChrome. It gates itself behind a mounted
 * check so nothing renders during SSR / the first client render (equivalent to
 * a `dynamic(ssr:false)` leaf): the banner's visibility depends on the cookie,
 * which is only known after mount, so rendering it server-side would flash for
 * visitors who already chose. A leaf module store — no provider wraps the tree.
 */
export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const { choice, prefsOpen } = useConsent();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {choice === null ? <CookieBanner /> : null}
      {prefsOpen ? <CookiePreferences /> : null}
    </>
  );
}
