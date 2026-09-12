import { Suspense } from "react";
import { Footer, Header, QuickContact } from "@/components/layout";
import { CookieConsent } from "@/components/consent/cookie-consent";
import { LocalBusinessJsonLd, WebSiteJsonLd } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { getServiceLinks } from "@/components/layout/get-service-links";
import { ThemeOverride } from "@/components/layout/theme-override";
import { resolveWhatsAppUrl } from "@/helpers";

type SiteChromeProps = {
  children: React.ReactNode;
};

async function SiteChromeContent({ children }: SiteChromeProps) {
  // In parallel: the header needs both, and serialising them would put two
  // sequential CMS round trips in front of every page's chrome.
  const [siteMetaConfig, serviceLinks] = await Promise.all([
    getSiteMetaConfig(),
    getServiceLinks(),
  ]);

  return (
    <>
      {/* Before anything paints: the tokens the whole page is coloured with. */}
      <ThemeOverride config={siteMetaConfig} />
      {siteMetaConfig ? <LocalBusinessJsonLd config={siteMetaConfig} /> : null}
      <WebSiteJsonLd config={siteMetaConfig} />
      <a
        href="#main"
        className="sr-only top-[50] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-dark focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Header config={siteMetaConfig} serviceLinks={serviceLinks} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer config={siteMetaConfig} />
      <QuickContact whatsappUrl={resolveWhatsAppUrl(siteMetaConfig)} />
      <CookieConsent />
    </>
  );
}

export function SiteChrome({ children }: SiteChromeProps) {
  return (
    <Suspense fallback={null}>
      <SiteChromeContent>{children}</SiteChromeContent>
    </Suspense>
  );
}
