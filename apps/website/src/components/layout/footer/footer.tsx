import type { ReactNode } from "react";

import type { SiteMetaConfigFragment } from "@/generated/graphql";

import Link from "next/link";

import { ZeroCmsEntry, ZeroCmsList } from "@usc/zero-cms-widget";

import {
  FOOTER_COMPANY_REGISTRATION,
  FOOTER_OPENING_HOURS,
} from "@/components/layout/footer/footer-static";

import {
  Accreditation,
  ACCREDITATION_LOGO_HEIGHT,
} from "@/components/ui/accreditation";

import { TrustpilotWidget } from "@/components/ui/trustpilot-widget";

import {
  FOOTER_COMPANY_LINKS,
  FOOTER_LEGAL_LINKS,
} from "@/components/layout/nav-links";

import { SiteBanner } from "@/components/layout/site-banner";

import { CookiePreferencesLink } from "@/components/consent/cookie-preferences-link";

import {
  formatAddress,
  formatPhoneDisplay,
  iconData,
  resolveLogoHeight,
  resolveSiteLogos,
  resolveSocialProfiles,
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
    <p className="mb-3.5 font-sans text-[11px] font-bold tracking-[0.1em] text-white/60 uppercase">
      {children}
    </p>
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

  const socialProfiles = resolveSocialProfiles(config);

  const currentYear = new Date().getFullYear();

  const hasContactDetails = Boolean(phone || email);

  const accreditations = config?.footerAccreditations?.filter(Boolean) ?? [];

  const accreditationHeight = resolveLogoHeight(
    config?.footerLogoSize,
    ACCREDITATION_LOGO_HEIGHT,
  );

  const accreditationGlow = config?.footerGlowColor?.trim() || null;
  const accreditationGlowRadius = config?.footerGlowRadius ?? null;
  const accreditationGlowIntensity = config?.footerGlowIntensity ?? null;

  // Trailing period stripped because the line that prints this adds its own.
  // The CMS legalName is written the way a company writes it — "Upper Street
  // Handyman Ltd." — so appending unconditionally rendered "Ltd.." on every
  // page. Fixed here rather than in the CMS value so it stays right whichever
  // way the next editor types the name.
  const copyrightName = (
    legalName ??
    config?.siteName ??
    "Upper Street Contractors"
  ).replace(/[.\s]+$/, "");

  return (
    <footer className="bg-dark-2 font-sans text-white/55">
      <div className="mx-auto max-w-container px-6 pt-14 pb-7">
        {/* Three columns, not four: the Services column (the nine trades) is
            gone. `/services` carries them now and is linked from Company. */}
        <div className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr] lg:gap-12">
          <div>
            {/* The margin sits on the wrapper, not on the artwork, which
                carries only its height. Larger than the desktop header's h-16
                so the mark signs off heavier than it opens — the footer
                gives it a whole column and no nav competing for the row, so it
                is deliberately larger here than the desktop header's h-16. */}
            <div className="mb-3">
              <SiteBanner
                tone="light"
                siteName={config?.siteName}
                logos={resolveSiteLogos(config)}
                className="h-26"
              />
            </div>

            {description ? (
              <p className="text-[13px] leading-[1.75] text-white/70 mt-3">
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

              </ul>
            ) : null}

            <div className="mt-5 space-y-0.5 text-[13px] leading-[1.85] text-white/55">
              {FOOTER_OPENING_HOURS.map((hours) => (
                <p key={hours}>{hours}</p>
              ))}
            </div>
          </div>
        </div>

        {/* The Social row: its own band, right-aligned under the columns and
            above the trust row. Right rather than centred so it reads as
            belonging to the columns it sits under, and stays clear of the
            centred badges below it. Its links come from the same Social
            profiles the structured data publishes, so the icons on screen and
            the profiles we claim to search engines cannot disagree. */}
        {socialProfiles.length > 0 ? (
          <div className="mb-8 flex justify-center sm:justify-end">
            <h2 className="sr-only">Follow us</h2>
            <ul className="flex flex-wrap items-center gap-2.5">
              {socialProfiles.map((profile) => (
                <li key={profile.id}>
                  <a
                    href={profile.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    aria-label={profile.name}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[5px] bg-white/10 text-white/70 transition-colors hover:bg-gold hover:text-white"
                  >
                    <Icon data={iconData(profile.icon)} className="h-4 w-4 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* The trust row: full width, its own band between the columns and the
            legal bar. It replaced three hardcoded text labels that had drifted
            from the real accreditations the home page already showed as logos —
            these are CMS content on the Site settings' Footer tab. */}
        {accreditations.length > 0 ? (
          <div className="mb-8 border-t border-white/[0.08] pt-8">
            <h2 className="sr-only">Our accreditations</h2>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {/* `theme="dark"` is load-bearing, not decoration: the vendor's
                  light theme prints near-black type, which on a navy footer is
                  invisible while the stars still render — so it reads as a
                  broken widget rather than an unreadable one.

                  96px rather than the variant's 130: `mini` scales its content
                  to that box, and at full size it towered over the badges
                  beside it. `footerLogoSize` still cannot apply here — this is
                  a vendor iframe, not one of our images — and neither can the
                  hover, since there is no element of ours to transform.
                  Consent-gated: an inert placeholder until the visitor opts in. */}
              <TrustpilotWidget
                variant="mini"
                theme="dark"
                styleHeight="96px"
              />

              <ZeroCmsList
                className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5"
                field="footerAccreditations"
                items={accreditations}
              >
                {accreditations.map((accreditation) => (
                  <ZeroCmsEntry key={accreditation.id} entry={accreditation}>
                    {/* The hover lift lives inside <Accreditation> now, shared
                        with the home Accreditations section. */}
                    <Accreditation
                      data={accreditation}
                      height={accreditationHeight}
                      // No solid white tile on a dark footer — a faint wash
                      // plus the glow is what separates each mark from the
                      // background.
                      bare
                      glowColor={accreditationGlow}
                      glowRadius={accreditationGlowRadius}
                      glowIntensity={accreditationGlowIntensity}
                    />
                  </ZeroCmsEntry>
                ))}
              </ZeroCmsList>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/[0.08] pt-5 text-xs text-white/55">
          <p>
            © {currentYear} {copyrightName}. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="underline-offset-2 transition-colors hover:text-white hover:underline"
              >
                {link.label}
              </Link>
            ))}
            <CookiePreferencesLink />
            <p className="text-white/60">{FOOTER_COMPANY_REGISTRATION}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
