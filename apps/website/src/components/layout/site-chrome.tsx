import { Suspense } from "react";
import { Footer, Header, QuickContact } from "@/components/layout";
import { LocalBusinessJsonLd } from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";
import { resolveWhatsAppUrl } from "@/helpers";

type SiteChromeProps = {
  children: React.ReactNode;
};

async function SiteChromeContent({ children }: SiteChromeProps) {
  const siteMetaConfig = await getSiteMetaConfig();

  return (
    <>
      {siteMetaConfig ? <LocalBusinessJsonLd config={siteMetaConfig} /> : null}
      <a
        href="#main"
        className="sr-only top-[50] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-dark focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Header config={siteMetaConfig} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer config={siteMetaConfig} />
      <QuickContact whatsappUrl={resolveWhatsAppUrl(siteMetaConfig)} />
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
