import type { ReactNode } from "react";
import type { SiteMetaConfigFragment } from "@/generated/graphql";
import Link from "next/link";
import {
  FOOTER_COMPANY_LINKS,
  FOOTER_SERVICE_LINKS,
} from "@/components/layout/nav-links";
import { SiteLogo } from "@/components/layout/site-logo";
import {
  formatAddress,
  formatPhoneDisplay,
  iconData,
  resolveWhatsAppUrl,
} from "@/helpers";
import { Icon } from "@/components/ui/icon";

type FooterProps = {
  config: SiteMetaConfigFragment | null;
};

function formatTelHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

function FooterColumnHeading({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-[11px] font-bold tracking-[0.14em] text-subtle uppercase">
      {children}
    </p>
  );
}

function FooterLinkList({ links }: { links: { label: string; href: string }[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="font-sans text-sm text-subtle transition-colors hover:text-white"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Footer({ config }: FooterProps) {
  const address = formatAddress(config);
  const phone = config?.phoneNumber
    ? formatPhoneDisplay(config.phoneNumber)
    : null;
  const email = config?.email ?? null;
  const description = config?.defaultMetaDescription ?? null;
  const legalName = config?.legalName ?? null;
  const whatsappUrl = resolveWhatsAppUrl(config);
  const currentYear = new Date().getFullYear();
  const hasContactDetails = Boolean(phone || email || whatsappUrl);

  return (
    <footer className="bg-dark font-sans text-subtle">
      <div className="mx-auto max-w-container px-6 py-14 lg:px-10 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <SiteLogo
              siteName={config?.siteName}
              streetClassName="text-white"
              suffixClassName="text-gold"
              className="text-[1.375rem] leading-none"
            />
            {description ? (
              <p className="mt-4 max-w-[17rem] text-sm leading-[1.65] text-subtle">
                {description}
              </p>
            ) : null}
            {address ? (
              <p className="mt-4 flex items-start gap-2 text-sm leading-[1.65] text-subtle">
                <Icon
                  data={iconData("pin")}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e879a8]"
                />
                <span>{address}</span>
              </p>
            ) : null}
          </div>

          <div>
            <FooterColumnHeading>Services</FooterColumnHeading>
            <FooterLinkList links={FOOTER_SERVICE_LINKS} />
          </div>

          <div>
            <FooterColumnHeading>Company</FooterColumnHeading>
            <FooterLinkList links={FOOTER_COMPANY_LINKS} />
          </div>

          {hasContactDetails ? (
            <div>
              <FooterColumnHeading>Contact</FooterColumnHeading>
              <ul className="mt-4 space-y-2.5 text-sm">
                {phone ? (
                  <li>
                    <a
                      href={formatTelHref(phone)}
                      className="inline-flex items-center gap-2 text-subtle transition-colors hover:text-white"
                    >
                      <Icon
                        data={iconData("phone")}
                        className="h-3.5 w-3.5 shrink-0 text-[#e879a8]"
                      />
                      {phone}
                    </a>
                  </li>
                ) : null}
                {email ? (
                  <li>
                    <a
                      href={`mailto:${email}`}
                      className="inline-flex items-center gap-2 text-subtle transition-colors hover:text-white"
                    >
                      <Icon
                        data={iconData("envelope")}
                        className="h-3.5 w-3.5 shrink-0 text-subtle"
                      />
                      {email}
                    </a>
                  </li>
                ) : null}
                {whatsappUrl ? (
                  <li>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-subtle transition-colors hover:text-white"
                    >
                      <Icon
                        data={iconData("chat")}
                        className="h-3.5 w-3.5 shrink-0 text-subtle"
                      />
                      WhatsApp available
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        {legalName ? (
          <div className="mt-12 border-t border-white/10 pt-6">
            <p className="text-xs text-subtle">
              © {currentYear} {legalName}. All rights reserved.
            </p>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
