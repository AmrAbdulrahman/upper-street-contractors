"use client";

import { useMemo } from "react";
import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { HeaderDesktopNav } from "@/components/layout/header/header-desktop-nav";
import { HeaderMobileNav } from "@/components/layout/header/header-mobile-nav";
import { buildMainNavLinks, type NavLink } from "@/components/layout/nav-links";
import { SiteBanner } from "@/components/layout/site-banner";
import { resolveSiteLogos, resolveWhatsAppUrl } from "@/helpers";

type HeaderProps = {
  config: SiteMetaConfigFragment | null;
  /**
   * The Services dropdown, read from the CMS by the server component that
   * mounts this. Passed in rather than fetched: the header is a client
   * component (`usePathname` for active state), so it cannot read the CMS.
   */
  serviceLinks: NavLink[];
};

/**
 * One row: the brand lockup beside the nav.
 *
 * It used to be two rows — the lockup above a row of nine service links — with
 * the crest shrinking on scroll. Both of those are gone. The Services menu
 * folded the nine trades into one item, which left the nav narrow enough to sit
 * next to the lockup instead of under it, and with a single fixed-height row
 * there is nothing left to collapse.
 *
 * Dropping the scroll behaviour also retires the `useScrolled` hysteresis that
 * used to live here: it needed two thresholds only because shrinking the header
 * removed document height, scroll anchoring pulled `scrollY` back below a
 * single threshold, and the header oscillated. A header that never changes
 * height cannot do that.
 *
 * The crest and the wordmark are rendered at the SAME height. Their artwork is
 * 234×287 and 491×287 — one shared 287-unit box — so equal heights reproduce the
 * proportions of the original combined lockup. (The old header deliberately
 * sized them apart, because the crest had to shrink and the words had to stay
 * readable; with no shrinking, that reason is gone.)
 */
export function Header({ config, serviceLinks }: HeaderProps) {
  const whatsappUrl = resolveWhatsAppUrl(config);
  const logos = resolveSiteLogos(config);
  // Memoised so the mobile and desktop navs get one stable array per render
  // rather than two fresh ones, which would defeat any memo below them.
  const navLinks = useMemo(() => buildMainNavLinks(serviceLinks), [serviceLinks]);

  return (
    <header className="sticky top-[var(--admin-banner-offset,0px)] z-100 w-full border-b border-border bg-white">
      <div className="mx-auto w-full max-w-container px-6 lg:px-10">
        {/* Mobile — lockup + hamburger */}
        <div className="flex items-center justify-between gap-4 py-3 lg:hidden">
          <SiteBanner
            tone="dark"
            siteName={config?.siteName}
            logos={logos}
            className="h-11"
          />

          <HeaderMobileNav links={navLinks} whatsappUrl={whatsappUrl} />
        </div>

        {/* Desktop — lockup and nav on one line */}
        <div className="hidden items-center justify-between gap-8 py-3 lg:flex">
          <SiteBanner
            tone="dark"
            siteName={config?.siteName}
            logos={logos}
            className="h-16"
          />

          <HeaderDesktopNav links={navLinks} />
        </div>
      </div>
    </header>
  );
}
