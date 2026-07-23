"use client";

import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { useEffect, useState } from "react";
import { HeaderDesktopNav } from "@/components/layout/header/header-desktop-nav";
import { HeaderMobileNav } from "@/components/layout/header/header-mobile-nav";
import { MAIN_NAV_LINKS } from "@/components/layout/nav-links";
import { SiteBanner } from "@/components/layout/site-banner";
import { resolveWhatsAppUrl } from "@/helpers";

type HeaderProps = {
  config: SiteMetaConfigFragment | null;
};

/**
 * Toggles once the page is scrolled past a threshold (rAF-throttled).
 *
 * Collapse and expand use different thresholds (hysteresis): shrinking the
 * header removes ~60px of document height, and scroll anchoring pulls
 * scrollY down by the same amount — with a single threshold that drop lands
 * back below it and the header oscillates. The gap between the two
 * thresholds must stay larger than the header's collapsed/expanded height
 * difference.
 */
function useScrolled(collapseAt = 96, expandAt = 24): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setScrolled((prev) =>
          prev ? window.scrollY > expandAt : window.scrollY > collapseAt,
        );
        frame = 0;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [collapseAt, expandAt]);

  return scrolled;
}

export function Header({ config }: HeaderProps) {
  const whatsappUrl = resolveWhatsAppUrl(config);
  const scrolled = useScrolled();

  return (
    <header className="sticky top-[var(--admin-banner-offset,0px)] z-100 w-full border-b border-border bg-white">
      <div className="mx-auto w-full max-w-container px-6 lg:px-10">
        {/* Mobile — single compact row */}
        <div className="flex items-center justify-between gap-4 py-3 lg:hidden">
          <SiteBanner
            tone="dark"
            siteName={config?.siteName}
            className={`transition-[height] duration-300 ${scrolled ? "h-8" : "h-11"}`}
          />
          <HeaderMobileNav links={MAIN_NAV_LINKS} whatsappUrl={whatsappUrl} />
        </div>

        {/* Desktop — two rows: banner + CTAs, then the service links */}
        <div className="hidden lg:block">
          <div
            className={`flex items-center justify-between gap-6 transition-[padding] duration-300 ${
              scrolled ? "py-2.5" : "py-4"
            }`}
          >
            <SiteBanner
              tone="dark"
              siteName={config?.siteName}
              className={`transition-[height] duration-300 ${scrolled ? "h-10" : "h-20"}`}
            />
          </div>

          <div
            className={`border-t border-border-light transition-[padding] duration-300 ${
              scrolled ? "py-1.5" : "py-2.5"
            }`}
          >
            <HeaderDesktopNav links={MAIN_NAV_LINKS} />
          </div>
        </div>
      </div>
    </header>
  );
}
