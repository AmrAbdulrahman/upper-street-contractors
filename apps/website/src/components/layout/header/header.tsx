"use client";

import type { SiteMetaConfigFragment } from "@/generated/graphql";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HeaderDesktopNav } from "@/components/layout/header/header-desktop-nav";
import { HeaderMobileNav } from "@/components/layout/header/header-mobile-nav";
import { MAIN_NAV_LINKS } from "@/components/layout/nav-links";
import { SiteBanner } from "@/components/layout/site-banner";
import { resolveWhatsAppUrl, iconData } from "@/helpers";
import { Icon } from "@/components/ui/icon";

type HeaderProps = {
  config: SiteMetaConfigFragment | null;
};

const quoteButtonClass =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-border bg-white px-5 text-sm font-semibold text-dark transition-colors hover:bg-border-light xl:text-[0.9375rem]";

const whatsappButtonClass =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-whatsapp px-5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 xl:text-[0.9375rem]";

/** Toggles once the page is scrolled past a small threshold (rAF-throttled). */
function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setScrolled(window.scrollY > threshold);
        frame = 0;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

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
            className={`transition-[height] duration-300 ${scrolled ? "h-8" : "h-9"}`}
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
              className={`transition-[height] duration-300 ${scrolled ? "h-10" : "h-16"}`}
            />

            <div className="flex shrink-0 items-center justify-end gap-3">
              <Link href="/contact" className={quoteButtonClass}>
                Request a Quote
              </Link>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={whatsappButtonClass}
                >
                  <Icon data={iconData("whatsapp")} className="h-4 w-4 shrink-0" />
                  WhatsApp
                </a>
              ) : null}
            </div>
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
