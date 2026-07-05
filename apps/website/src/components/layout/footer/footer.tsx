import type { ReactNode } from "react";

import type { SiteMetaConfigFragment } from "@/generated/graphql";

import Link from "next/link";

import {
  FOOTER_ACCREDITATIONS,
  FOOTER_COMPANY_REGISTRATION,
  FOOTER_OPENING_HOURS,
} from "@/components/layout/footer/footer-static";

import {
  FOOTER_COMPANY_LINKS,
  FOOTER_SERVICE_LINKS,
} from "@/components/layout/nav-links";

import { SiteBanner } from "@/components/layout/site-banner";

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
    <p className="mb-3.5 font-sans text-[11px] font-bold tracking-[0.1em] text-white/35 uppercase">
      {children}
    </p>
  );
}

function FooterBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[6px] border border-white/10 bg-white/[0.07] px-2.5 py-[5px] text-[11px] font-semibold text-white/60">
      {children}
    </span>
  );
}

function FooterLinkList({
  links,
}: {
  links: { label: string; href: string }[];
}) {
  return (
    <ul className="flex flex-col gap-[9px]">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="font-sans text-[13px] text-white/55 transition-colors hover:text-white"
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

  const copyrightName =
    legalName ?? config?.siteName ?? "Upper Street Contractors";

  return (
    <footer className="bg-dark-2 font-sans text-white/55">
      <div className="mx-auto max-w-container px-6 pt-14 pb-7">
        <div className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr] lg:gap-12">
          <div>
            <SiteBanner
              tone="light"
              siteName={config?.siteName}
              className="mb-3 h-12"
            />

            {description ? (
              <p className="text-[13px] leading-[1.75] text-muted mt-3">
                {description}
              </p>
            ) : null}

            {address ? (
              <p className="mt-3 flex items-start gap-2 text-[12px] leading-[1.75] text-white/55">
                <Icon
                  data={iconData("pin")}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold"
                />

                <span>{address}</span>
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {FOOTER_ACCREDITATIONS.map((label) => (
                <FooterBadge key={label}>{label}</FooterBadge>
              ))}
            </div>
          </div>

          <div>
            <FooterColumnHeading>Services</FooterColumnHeading>

            <FooterLinkList links={FOOTER_SERVICE_LINKS} />
          </div>

          <div>
            <FooterColumnHeading>Company</FooterColumnHeading>

            <FooterLinkList links={FOOTER_COMPANY_LINKS} />
          </div>

          <div>
            <FooterColumnHeading>Contact</FooterColumnHeading>

            {hasContactDetails ? (
              <ul className="flex flex-col gap-[9px] text-[13px]">
                {phone ? (
                  <li>
                    <a
                      href={formatTelHref(phone)}
                      className="inline-flex items-center gap-2 text-white/55 transition-colors hover:text-white"
                    >
                      <Icon
                        data={iconData("phone")}
                        className="h-3.5 w-3.5 shrink-0 text-gold"
                      />

                      {phone}
                    </a>
                  </li>
                ) : null}

                {email ? (
                  <li>
                    <a
                      href={`mailto:${email}`}
                      className="inline-flex items-center gap-2 text-white/55 transition-colors hover:text-white"
                    >
                      <Icon
                        data={iconData("envelope")}
                        className="h-3.5 w-3.5 shrink-0 text-gold"
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
                      className="inline-flex items-center gap-2 text-white/55 transition-colors hover:text-white"
                    >
                      <Icon
                        data={iconData("chat")}
                        className="h-3.5 w-3.5 shrink-0 text-gold"
                      />
                      WhatsApp available
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="mt-5 space-y-0.5 text-[13px] leading-[1.85] text-white/55">
              {FOOTER_OPENING_HOURS.map((hours) => (
                <p key={hours}>{hours}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/[0.08] pt-5 text-xs text-white/55">
          <p>
            © {currentYear} {copyrightName}. All rights reserved.
          </p>

          <p className="text-white/35">{FOOTER_COMPANY_REGISTRATION}</p>
        </div>
      </div>
    </footer>
  );
}
