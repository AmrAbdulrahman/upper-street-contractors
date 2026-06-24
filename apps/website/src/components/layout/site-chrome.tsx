import { Suspense } from "react";
import { AdminBanner } from "@/components/admin-banner";
import { EditDrawerMount } from "@/components/edit-drawer";
import { StrapiInspectionProvider } from "@/components/strapi";
import { isPreviewEnabled } from "@/helpers/preview-utils";
import { Footer, Header } from "@/components/layout";
import {
  isStrapiInspectionBuildEnabled,
  LocalBusinessJsonLd,
} from "@/components/metadata";
import { getSiteMetaConfig } from "@/components/site-meta-config";

type SiteChromeProps = {
  children: React.ReactNode;
};

async function SiteChromeContent({ children }: SiteChromeProps) {
  const siteMetaConfig = await getSiteMetaConfig();
  const strapiUrl =
    process.env.NEXT_PUBLIC_STRAPI_URL ??
    process.env.STRAPI_URL ??
    "http://localhost:1337";

  const body = (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-dark focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      {isPreviewEnabled() ? (
        <Suspense fallback={null}>
          <AdminBanner
            siteMetaConfigId={siteMetaConfig?.documentId ?? null}
          />
        </Suspense>
      ) : null}
      <Header config={siteMetaConfig} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer config={siteMetaConfig} />
    </>
  );

  return (
    <>
      {siteMetaConfig ? <LocalBusinessJsonLd config={siteMetaConfig} /> : null}
      {isStrapiInspectionBuildEnabled() ? (
        <Suspense fallback={body}>
          <StrapiInspectionProvider strapiUrl={strapiUrl}>
            {body}
            <EditDrawerMount />
          </StrapiInspectionProvider>
        </Suspense>
      ) : (
        body
      )}
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
