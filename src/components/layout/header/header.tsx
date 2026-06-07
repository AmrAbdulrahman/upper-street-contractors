import type { SiteMetaConfigFragment } from "@/generated/graphql";
import Link from "next/link";
import { MAIN_NAV_LINKS } from "@/components/layout/nav-links";
import { SiteLogo } from "@/components/layout/site-logo";
import { resolveWhatsAppUrl, iconData } from "@/helpers";
import { Icon } from "@/components/ui/icon";

type HeaderProps = {
  config: SiteMetaConfigFragment | null;
};

const navLinkClass =
  "whitespace-nowrap text-sm font-medium text-muted transition-colors hover:text-dark xl:text-[0.9375rem]";

const quoteButtonClass =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-border bg-white px-5 text-sm font-semibold text-dark transition-colors hover:bg-border-light xl:text-[0.9375rem]";

const whatsappButtonClass =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-whatsapp px-5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 xl:text-[0.9375rem]";

export function Header({ config }: HeaderProps) {
  const whatsappUrl = resolveWhatsAppUrl(config);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white">
      <div className="mx-auto w-full max-w-[1320px] px-6 py-4 lg:px-10">
        <div className="grid w-full grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(0,auto)] items-center gap-6">
          <SiteLogo siteName={config?.siteName} />

          <nav
            aria-label="Main navigation"
            className="hidden min-w-0 overflow-hidden lg:block"
          >
            <ul className="flex items-center justify-center gap-4 xl:gap-6">
              {MAIN_NAV_LINKS.map((link) => (
                <li key={link.href} className="shrink-0">
                  <Link href={link.href} className={navLinkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

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
      </div>

      <nav
        aria-label="Main navigation"
        className="border-t border-border-light lg:hidden"
      >
        <ul className="mx-auto flex max-w-[1320px] gap-6 overflow-x-auto px-6 py-3 lg:px-10">
          {MAIN_NAV_LINKS.map((link) => (
            <li key={link.href} className="shrink-0">
              <Link href={link.href} className={navLinkClass}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
